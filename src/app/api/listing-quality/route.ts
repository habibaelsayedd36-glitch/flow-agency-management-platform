import { desc, eq, inArray, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { productContents, products, projects, workflowSteps } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

function scoreContent(content: typeof productContents.$inferSelect | undefined, product: typeof products.$inferSelect) {
  if (!content) return { score: 0, issues: ["No listing content"], missingKeywords: [], checks: { title: false, description: false, bullets: false, keywords: false, specifications: false, marketplace: Boolean(product.targetMarketplace) } };
  const title = Boolean(content.title?.trim());
  const description = Boolean((content.fullDescription || "").trim().length >= 80);
  const bullets = (content.bulletPoints || []).filter((item) => item.trim()).length >= 5;
  const keywords = (content.keywords || []).filter((item) => item.trim()).length >= 5;
  const specifications = Object.keys(content.specifications || {}).length > 0;
  const marketplace = Boolean(product.targetMarketplace?.trim());
  const primary = (content.keywords || [])[0]?.toLowerCase().trim();
  const searchable = `${content.title || ""} ${content.shortDescription || ""} ${content.fullDescription || ""}`.toLowerCase();
  const keywordInTitle = Boolean(primary && (content.title || "").toLowerCase().includes(primary));
  const keywordInDescription = Boolean(primary && searchable.includes(primary));
  const score = (title ? 20 : 0) + (description ? 20 : 0) + (Boolean(content.shortDescription?.trim()) ? 10 : 0) + (bullets ? 20 : 0) + (keywords ? 15 : 0) + (specifications ? 5 : 0) + (marketplace ? 10 : 0);
  const issues: string[] = [];
  if (!title) issues.push("Missing title");
  if (!description) issues.push("Description is missing or too short");
  if (!content.shortDescription?.trim()) issues.push("Missing short description");
  if (!bullets) issues.push("Add at least 5 bullet points");
  if (!keywords) issues.push("Add at least 5 relevant keywords");
  if (!specifications) issues.push("Add product specifications");
  if (!marketplace) issues.push("No target marketplace selected");
  if (primary && !keywordInTitle) issues.push("Primary keyword is missing from title");
  if (primary && !keywordInDescription) issues.push("Primary keyword is missing from description");
  const missingKeywords = (content.keywords || []).filter((word) => !searchable.includes(word.toLowerCase())).slice(0, 8);
  return { score, issues, missingKeywords, checks: { title, description, bullets, keywords, specifications, marketplace, keywordInTitle, keywordInDescription }, version: content.version, status: content.status };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "production_manager", "account_manager", "content_creator"]);
    requireActiveAccount(user);
    let productScope: SQL | undefined;
    if (user.role === "account_manager") {
      const assigned = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
      const orgIds = [...new Set(assigned.map((row) => row.organizationId))];
      productScope = orgIds.length ? inArray(products.organizationId, orgIds) : eq(products.id, "00000000-0000-0000-0000-000000000000");
    } else if (user.role === "content_creator") {
      const assigned = await db.select({ productId: workflowSteps.productId }).from(workflowSteps).where(eq(workflowSteps.assignedTo, user.id));
      const ids = [...new Set(assigned.map((row) => row.productId))];
      productScope = ids.length ? inArray(products.id, ids) : eq(products.id, "00000000-0000-0000-0000-000000000000");
    }
    const productRows = await db.select().from(products).where(productScope).orderBy(desc(products.updatedAt)).limit(500);
    const productIds = productRows.map((item) => item.id);
    const contents = productIds.length ? await db.select().from(productContents).where(inArray(productContents.productId, productIds)).orderBy(desc(productContents.version)) : [];
    const latest = new Map<string, typeof contents[number]>();
    for (const item of contents) {
      const key = `${item.productId}:${item.language}`;
      if (!latest.has(key)) latest.set(key, item);
    }
    const rows = productRows.map((product) => {
      const en = scoreContent(latest.get(`${product.id}:en`), product);
      const ar = scoreContent(latest.get(`${product.id}:ar`), product);
      const present = [latest.has(`${product.id}:en`), latest.has(`${product.id}:ar`)].filter(Boolean).length;
      return { id: product.id, name: product.name, sku: product.sku, brand: product.brand, targetMarketplace: product.targetMarketplace, en, ar, overall: present ? Math.round((en.score + ar.score) / (present === 2 ? 2 : 1)) : 0, contentLanguages: present };
    });
    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.overall, 0) / rows.length) : 0;
    return NextResponse.json({ products: rows, summary: { total: rows.length, average, needsWork: rows.filter((row) => row.overall < 70).length, missingContent: rows.filter((row) => row.contentLanguages === 0).length } });
  } catch (error) { return apiError(error); }
}
