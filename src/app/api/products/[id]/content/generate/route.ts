import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { apiError, assertSameOrigin, ApiError } from "@/lib/api";
import { assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";

function clean(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function makeKeywords(name: string, brand: string, category: string, productType: string, marketplace: string): string[] {
  return unique([name, brand, category, productType, ...marketplace.split(/[,·]/).map((part) => part.trim()), "online shopping", "product listing"]).slice(0, 12);
}

function buildListing(row: Record<string, unknown>, locale: "en" | "ar") {
  const name = clean(row.name) || (locale === "ar" ? "منتج جديد" : "New Product");
  const brand = clean(row.brand);
  const category = clean(row.category);
  const productType = clean(row.productType);
  const description = clean(row.description);
  const marketplace = clean(row.targetMarketplace);
  const specs = row.specifications && typeof row.specifications === "object" ? Object.entries(row.specifications as Record<string, unknown>).filter(([, value]) => clean(value)) : [];
  const specLines = specs.map(([key, value]) => locale === "ar" ? `${key}: ${clean(value)}` : `${key}: ${clean(value)}`);
  const keywords = makeKeywords(name, brand, category, productType, marketplace);
  if (locale === "en") {
    const title = [brand, name, productType && productType.toLowerCase() !== name.toLowerCase() ? productType : ""].filter(Boolean).join(" ");
    const facts = [brand && `Brand: ${brand}`, category && `Category: ${category}`, productType && `Product type: ${productType}`, ...specLines];
    const shortDescription = description || `${name}${category ? ` in the ${category} category` : ""}. Explore the product details and specifications below.`;
    const fullDescription = [description || `${name} is presented with the product information currently available in this listing.`, facts.length ? `Product details:\\n${facts.join("\\n")}` : "", "Please refer to the listed details for product information before purchase."].filter(Boolean).join("\\n\\n");
    const bulletPoints = unique([brand && `Brand: ${brand}`, category && `Category: ${category}`, productType && `Product type: ${productType}`, ...specLines, description && description.slice(0, 180)]).slice(0, 5);
    return { title: title.slice(0, 180), shortDescription: shortDescription.slice(0, 500), fullDescription: fullDescription.slice(0, 4000), bulletPoints, keywords };
  }
  const title = [brand, name, productType && productType.toLowerCase() !== name.toLowerCase() ? productType : ""].filter(Boolean).join(" ");
  const facts = [brand && `العلامة التجارية: ${brand}`, category && `الفئة: ${category}`, productType && `نوع المنتج: ${productType}`, ...specLines];
  const shortDescription = description || `${name}${category ? ` ضمن فئة ${category}` : ""}. تعرّف على تفاصيل المنتج والمواصفات المتاحة أدناه.`;
  const fullDescription = [description || `يتم عرض ${name} وفقًا لبيانات المنتج المتاحة حاليًا.`, facts.length ? `تفاصيل المنتج:\\n${facts.join("\\n")}` : "", "يرجى مراجعة التفاصيل الموضحة قبل إتمام الشراء."].filter(Boolean).join("\\n\\n");
  const bulletPoints = unique([brand && `العلامة التجارية: ${brand}`, category && `الفئة: ${category}`, productType && `نوع المنتج: ${productType}`, ...specLines, description && description.slice(0, 180)]).slice(0, 5);
  return { title: title.slice(0, 180), shortDescription: shortDescription.slice(0, 500), fullDescription: fullDescription.slice(0, 4000), bulletPoints, keywords };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "account_manager", "content_creator", "production_manager"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    await assertProductAccess(user, id);
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw new ApiError(404, "Product not found.", "NOT_FOUND");
    const source = row as unknown as Record<string, unknown>;
    const generated = { en: buildListing(source, "en"), ar: buildListing(source, "ar") };
    return NextResponse.json({ generated, generator: "built_in" });
  } catch (error) {
    return apiError(error);
  }
}
