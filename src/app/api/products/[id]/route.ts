import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files, marketplaceListings, productContents, products, workflowSteps } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { assertProductAccess, canManageWork, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";
import { FLOW_WORKFLOW } from "@/lib/workflow";

const productStatuses = FLOW_WORKFLOW.map((stage) => stage.key);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { id } = await context.params;
    const product = await assertProductAccess(user, id);
    const [steps, attachments, contentVersions] = await Promise.all([
      db.select().from(workflowSteps).where(eq(workflowSteps.productId, id)).orderBy(workflowSteps.stageOrder),
      db.select({ id: files.id, fileName: files.fileName, contentType: files.contentType, fileSize: files.fileSize, category: files.category, versionNumber: files.versionNumber, createdAt: files.createdAt, clientVisible: files.clientVisible }).from(files).where(eq(files.productId, id)).orderBy(desc(files.createdAt)),
      db.select().from(productContents).where(eq(productContents.productId, id)).orderBy(desc(productContents.version)),
    ]);
    const client = user.role === "client";
    return NextResponse.json({
      product: client ? { ...product, internalNotes: null } : product,
      workflow: steps.filter((step) => !client || step.clientVisible).map((step) => client ? { ...step, comment: step.clientVisible ? step.comment : null } : step),
      files: attachments.filter((file) => !client || file.clientVisible),
      contentVersions: contentVersions.filter((version) => !client || version.status === "ready_for_client" || version.status === "approved"),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "photographer", "content_creator", "production_manager"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    const product = await assertProductAccess(user, id);
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (user.role === "client") {
      if (!["submitted", "initial_review", "waiting_information"].includes(product.status)) {
        return NextResponse.json({ error: "Product details can no longer be changed after production has started." }, { status: 409 });
      }
      for (const field of ["name", "sku", "brand", "category", "productType", "description", "weight", "materials", "targetAudience", "clientInstructions"] as const) {
        if (body[field] !== undefined) updates[field] = field === "name" ? requireText(body[field], "Product name", 180) : optionalText(body[field], 4000);
      }
      if (body.targetMarketplace !== undefined) updates.targetMarketplace = optionalText(body.targetMarketplace, 80);
    } else {
      const canEdit = ["admin", "account_manager", "production_manager"].includes(user.role);
      if (canEdit) {
        for (const field of ["name", "sku", "brand", "category", "productType", "description", "weight", "materials", "targetAudience", "clientInstructions", "internalNotes"] as const) {
          if (body[field] !== undefined) updates[field] = field === "name" ? requireText(body[field], "Product name", 180) : optionalText(body[field], 5000);
        }
      }
      if (body.status !== undefined) {
        if (!canManageWork(user) || !productStatuses.includes(body.status)) return NextResponse.json({ error: "You cannot set that workflow status." }, { status: 403 });
        updates.status = body.status;
      }
    }
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: "No supported changes were provided." }, { status: 400 });
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    if (updates.status === "ready_for_publishing") {
      await db.update(marketplaceListings).set({ status: "ready_for_publishing", errorMessage: null, updatedAt: new Date() }).where(eq(marketplaceListings.productId, id));
    }
    if (typeof updates.status === "string" && updates.status !== product.status) {
      const currentStage = FLOW_WORKFLOW.find((stage) => stage.key === updates.status);
      if (currentStage) {
        await db.update(workflowSteps).set({ status: "complete", completedAt: new Date(), updatedAt: new Date() }).where(and(eq(workflowSteps.productId, id), eq(workflowSteps.stageKey, product.status)));
        await db.update(workflowSteps).set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() }).where(and(eq(workflowSteps.productId, id), eq(workflowSteps.stageKey, updates.status)));
      }
      await writeActivity({ actorId: user.id, organizationId: product.organizationId, entityType: "product", entityId: id, action: "product.status_changed", description: `${product.name} moved to ${String(updates.status).replaceAll("_", " ")}.`, visibility: "client" });
    }
    await writeAudit({ actorId: user.id, organizationId: product.organizationId, action: "product.updated", entityType: "product", entityId: id, previousValue: { status: product.status }, newValue: { status: updated.status } });
    return NextResponse.json({ product: updated });
  } catch (error) {
    return apiError(error);
  }
}
