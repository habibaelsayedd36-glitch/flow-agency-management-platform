import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { productContents } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText } from "@/lib/api";
import { assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

function cleanList(value: unknown, maximum: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 500)).slice(0, maximum);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { id } = await context.params;
    await assertProductAccess(user, id);
    const rows = await db.select().from(productContents).where(eq(productContents.productId, id)).orderBy(desc(productContents.version));
    return NextResponse.json({ versions: rows.filter((row) => user.role !== "client" || ["ready_for_client", "approved"].includes(row.status)) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "account_manager", "content_creator", "production_manager"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    const product = await assertProductAccess(user, id);
    const body = await request.json();
    const language = body.language === "ar" ? "ar" : "en";
    const title = optionalText(body.title, 300);
    if (!title) return NextResponse.json({ error: "A product title is required." }, { status: 400 });
    const fullDescription = optionalText(body.fullDescription, 12000);
    const shortDescription = optionalText(body.shortDescription, 2000);
    const bullets = cleanList(body.bulletPoints, 10);
    const keywords = cleanList(body.keywords, 30);
    const specifications = body.specifications && typeof body.specifications === "object" && !Array.isArray(body.specifications) ? body.specifications as Record<string, string> : {};
    const latest = await db.select().from(productContents)
      .where(eq(productContents.productId, id))
      .orderBy(desc(productContents.version))
      .limit(20);
    const sameLanguage = latest.find((row) => row.language === language);
    const sameContent = sameLanguage
      && sameLanguage.title === title
      && (sameLanguage.shortDescription || "") === (shortDescription || "")
      && (sameLanguage.fullDescription || "") === (fullDescription || "")
      && JSON.stringify(sameLanguage.bulletPoints || []) === JSON.stringify(bullets)
      && JSON.stringify(sameLanguage.keywords || []) === JSON.stringify(keywords);
    if (sameContent) return NextResponse.json({ content: sameLanguage, unchanged: true });
    const previousRows = await db.select({ version: productContents.version }).from(productContents).where(eq(productContents.productId, id)).orderBy(desc(productContents.version)).limit(1);
    const version = (previousRows[0]?.version ?? 0) + 1;
    const status = body.status === "ready_for_client" && ["admin", "account_manager", "production_manager"].includes(user.role) ? "ready_for_client" : "draft";
    const [content] = await db.insert(productContents).values({
      productId: id,
      version,
      language,
      title,
      shortDescription,
      fullDescription,
      bulletPoints: bullets,
      specifications,
      keywords,
      status,
      createdBy: user.id,
    }).returning();
    await writeActivity({ actorId: user.id, organizationId: product.organizationId, entityType: "product_content", entityId: content.id, action: "content.version_created", description: `A ${language === "ar" ? "Arabic" : "English"} listing version was added for “${product.name}”.`, visibility: status === "ready_for_client" ? "client" : "internal" });
    await writeAudit({ actorId: user.id, organizationId: product.organizationId, action: "product_content.created", entityType: "product_content", entityId: content.id, newValue: { productId: id, version, language, status } });
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
