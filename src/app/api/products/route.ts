import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceListings, marketplaces, products, projectMembers, projects, workflowSteps } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { assertOrganizationAccess, canManageWork, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";
import { FLOW_WORKFLOW } from "@/lib/workflow";
import { ensureFlowCatalog } from "@/lib/catalog";

const marketplaceNames = new Set(["Amazon", "Noon", "Jumia", "Shopify", "InstaShop", "Other"]);
const productStatuses = ["submitted", "initial_review", "waiting_information", "photography_scheduled", "photography_in_progress", "image_editing", "content_creation", "internal_quality_review", "awaiting_client_approval", "revision_requested", "approved", "ready_for_publishing", "published", "completed"] as const;

async function visibleProductCondition(user: Awaited<ReturnType<typeof requireAuth>>) {
  if (user.role === "client") return user.organizationId ? eq(products.organizationId, user.organizationId) : sql`false`;
  if (user.role === "admin" || user.role === "production_manager") return undefined;
  if (user.role === "account_manager") {
    const assigned = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
    const orgIds = [...new Set(assigned.map((row) => row.organizationId))];
    return orgIds.length ? inArray(products.organizationId, orgIds) : sql`false`;
  }
  const [tasks, memberships] = await Promise.all([
    db.select({ productId: workflowSteps.productId }).from(workflowSteps).where(eq(workflowSteps.assignedTo, user.id)),
    db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, user.id)),
  ]);
  const conditions: SQL[] = [];
  if (tasks.length) conditions.push(inArray(products.id, tasks.map((task) => task.productId)));
  if (memberships.length) conditions.push(inArray(products.projectId, memberships.map((member) => member.projectId)));
  return conditions.length ? or(...conditions) : sql`false`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const scope = await visibleProductCondition(user);
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();
    const status = searchParams.get("status");
    const filters = [scope];
    if (query) filters.push(or(ilike(products.name, `%${query}%`), ilike(products.sku, `%${query}%`)));
    if (status && productStatuses.includes(status as (typeof productStatuses)[number])) filters.push(eq(products.status, status as (typeof productStatuses)[number]));
    const rows = await db.select().from(products).where(and(...filters)).orderBy(desc(products.createdAt)).limit(500);
    return NextResponse.json({ products: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const body = await request.json();
    await ensureFlowCatalog();
    const organizationId = user.role === "client" ? user.organizationId : requireText(body.organizationId, "Workspace", 80);
    if (!organizationId) return NextResponse.json({ error: "A client workspace is required." }, { status: 400 });
    await assertOrganizationAccess(user, organizationId);
    const name = requireText(body.name, "Product name", 180);
    const marketplaceInput = Array.isArray(body.targetMarketplaces) ? body.targetMarketplaces : typeof body.targetMarketplace === "string" ? body.targetMarketplace.split(/[,;|]/) : [];
    const targetMarketplaces = [...new Set<string>(marketplaceInput.filter((item: unknown): item is string => typeof item === "string" && marketplaceNames.has(item.trim())).map((item: string) => item.trim()))];
    const targetMarketplace = targetMarketplaces.join(", ") || null;
    const requiredServices = Array.isArray(body.requiredServices)
      ? [...new Set<string>(body.requiredServices.filter((item: unknown): item is string => typeof item === "string" && item.length <= 80))].slice(0, 10)
      : [];
    const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
    if (projectId) {
      const [project] = await db.select({ id: projects.id, organizationId: projects.organizationId }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project || project.organizationId !== organizationId) return NextResponse.json({ error: "Project not found in this workspace." }, { status: 404 });
    }
    const [product] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(products).values({
        organizationId,
        projectId,
        name,
        sku: optionalText(body.sku, 100),
        brand: optionalText(body.brand, 120),
        category: optionalText(body.category, 120),
        productType: optionalText(body.productType, 100),
        description: optionalText(body.description, 8000),
        dimensions: body.dimensions && typeof body.dimensions === "object" ? body.dimensions : {},
        weight: optionalText(body.weight, 60),
        materials: optionalText(body.materials, 500),
        specifications: body.specifications && typeof body.specifications === "object" ? body.specifications : {},
        targetAudience: optionalText(body.targetAudience, 1000),
        targetMarketplace,
        requiredServices,
        clientInstructions: optionalText(body.clientInstructions, 3000),
        status: "submitted",
        createdBy: user.id,
      }).returning();
      await tx.insert(workflowSteps).values(FLOW_WORKFLOW.map((stage, index) => ({
        productId: inserted[0].id,
        stageKey: stage.key,
        stageLabel: stage.label,
        stageOrder: index + 1,
        status: index === 0 ? "in_progress" : "pending",
        startedAt: index === 0 ? new Date() : null,
        clientVisible: stage.clientVisible,
      })));
      if (targetMarketplaces.length) {
        const slugs = targetMarketplaces.map((name) => name.toLowerCase().replace(" ", ""));
        const channels = await tx.select({ id: marketplaces.id }).from(marketplaces).where(inArray(marketplaces.slug, slugs));
        if (channels.length) await tx.insert(marketplaceListings).values(channels.map((channel) => ({ productId: inserted[0].id, marketplaceId: channel.id, status: "not_published" as const }))).onConflictDoNothing();
      }
      return inserted;
    });
    await writeActivity({ actorId: user.id, organizationId, entityType: "product", entityId: product.id, action: "product.submitted", description: `${product.name} was submitted for production.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId, action: "product.created", entityType: "product", entityId: product.id, newValue: { name: product.name, status: product.status } });

    // Automatic bilingual listing is intentionally admin-only. Product creation
    // remains successful even if the optional AI service is unavailable.
    let autoListing: { status: "generated" | "failed" | "not_enabled"; message?: string } = { status: "not_enabled" };
    if (user.role === "admin") {
      try {
        const origin = request.nextUrl.origin;
        const cookie = request.headers.get("cookie") || "";
        const originHeader = request.headers.get("origin") || origin;
        const generatedResponse = await fetch(new URL(`/api/products/${product.id}/content/generate`, origin), {
          method: "POST",
          headers: { cookie, origin: originHeader, "content-type": "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(120000),
        });
        const generatedPayload = await generatedResponse.json() as {
          generated?: Record<"en" | "ar", {
            title: string; shortDescription: string; fullDescription: string;
            bulletPoints: string[]; keywords: string[];
          }>;
          error?: string;
        };
        if (!generatedResponse.ok || !generatedPayload.generated?.en || !generatedPayload.generated?.ar) {
          throw new Error(generatedPayload.error || "Automatic listing generation is unavailable.");
        }
        for (const language of ["en", "ar"] as const) {
          const listing = generatedPayload.generated[language];
          const savedResponse = await fetch(new URL(`/api/products/${product.id}/content`, origin), {
            method: "POST",
            headers: { cookie, origin: originHeader, "content-type": "application/json" },
            body: JSON.stringify({ language, ...listing, status: "draft" }),
            cache: "no-store",
            signal: AbortSignal.timeout(30000),
          });
          if (!savedResponse.ok) {
            const savedPayload = await savedResponse.json().catch(() => ({})) as { error?: string };
            throw new Error(savedPayload.error || `Could not save the ${language} listing draft.`);
          }
        }
        autoListing = { status: "generated", message: "Arabic and English drafts were created for admin review." };
      } catch (error) {
        console.error("FLOW admin automatic listing failed", { productId: product.id, error });
        autoListing = {
          status: "failed",
          message: error instanceof Error ? error.message : "Automatic listing generation failed. The product was saved; retry from Content Studio.",
        };
      }
    }
    return NextResponse.json({ product, autoListing }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
