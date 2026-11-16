import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { apiError, assertSameOrigin, ApiError } from "@/lib/api";
import { assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";

type Listing = {
  title: string;
  shortDescription: string;
  fullDescription: string;
  bulletPoints: string[];
  keywords: string[];
  qualityScore: number;
  missingInformation: string[];
};

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function list(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, max);
}

function parseListing(raw: string, locale: "en" | "ar"): Listing {
  const cleaned = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const title = text(parsed.title);
  if (!title) throw new Error("The AI model returned an empty listing title.");
  return {
    title: title.slice(0, 300),
    shortDescription: text(parsed.shortDescription).slice(0, 2000),
    fullDescription: text(parsed.fullDescription).slice(0, 12000),
    bulletPoints: list(parsed.bulletPoints, 10),
    keywords: list(parsed.keywords, 30),
    qualityScore: Math.max(0, Math.min(100, Number(parsed.qualityScore) || 0)),
    missingInformation: list(parsed.missingInformation, 20),
  };
}

function buildPrompt(product: Record<string, unknown>, locale: "en" | "ar", marketplaces: string[]) {
  const facts = {
    productName: text(product.name),
    brand: text(product.brand),
    category: text(product.category),
    productType: text(product.productType),
    existingDescription: text(product.description),
    sku: text(product.sku),
    materials: text(product.materials),
    weight: text(product.weight),
    dimensions: product.dimensions ?? {},
    specifications: product.specifications ?? {},
    targetAudience: text(product.targetAudience),
    clientInstructions: text(product.clientInstructions),
    selectedMarketplaces: marketplaces,
  };
  const language = locale === "ar" ? "Arabic (natural, professional Modern Standard Arabic; do not translate awkwardly)" : "English (natural, professional marketplace English)";
  return `You are a senior ecommerce marketplace listing copywriter and product-content quality reviewer.
Create a complete, customer-facing ecommerce listing in ${language}, not a product data summary.

STRICT FACT RULES:
- Use only facts explicitly present in Product facts. Never invent ingredients, skin benefits, treatment claims, SPF, formulation, size, quantity, country of origin, certifications, compatibility, guarantees, awards, or performance.
- A product name containing "Cica" does NOT prove any specific ingredient concentration, healing effect, suitability, or clinical benefit.
- Do not turn metadata into prose. Never output lines such as "Brand: ...", "Category: ...", "Product type: ...", or a list of field labels.
- Never use the words "online shopping", "product listing", "high quality", "shop now", or filler copy.
- If details are missing, write neutral, useful copy based only on the product identity and format. Do not pad with invented benefits. Add precise missing facts to missingInformation.

CONTENT REQUIREMENTS:
- title: natural marketplace title, include brand + product name + product type only where supplied; no keyword stuffing.
- shortDescription: 1–2 persuasive, specific sentences for shoppers. Never merely repeat the product name or the word cream.
- fullDescription: 2–3 coherent paragraphs that explain what the product is and what is actually known. It must not be a metadata dump.
- bulletPoints: 4–6 distinct shopper-facing points. If the source does not support feature claims, use safe points about the product identity, format, and information the shopper should verify; never fabricate features.
- keywords: 8–15 relevant search phrases derived from the product name, brand, type and category. Exclude marketplace names, generic ecommerce terms, and unsupported ingredient/benefit terms.
- Keep Arabic idiomatic and natural; do not translate awkwardly.
- Tailor wording to the selected marketplaces without claiming guaranteed ranking or policy compliance.
Selected marketplaces: ${marketplaces.join(", ") || "Not specified"}. Respect common marketplace listing conventions, but do not claim exact platform compliance where category-specific rules are unknown.
Return ONLY valid JSON with this exact shape:
{"title":"...","shortDescription":"...","fullDescription":"...","bulletPoints":["..."],"keywords":["..."],"qualityScore":0,"missingInformation":["..."]}
qualityScore is an honest 0–100 score for the completeness and usefulness of the listing based on supplied facts; lower it when essential product details are absent. missingInformation contains specific facts the client should supply, or [] if none.
Product facts:
${JSON.stringify(facts)}`;
}

async function generateWithAI(prompt: string, request: NextRequest): Promise<string> {
  let oidcToken: string | undefined;
  if (!process.env.AI_GATEWAY_API_KEY) {
    try { oidcToken = await getVercelOidcToken(); } catch { oidcToken = process.env.VERCEL_OIDC_TOKEN; }
  }
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken;
  if (!token) {
    throw new ApiError(503, "AI listing generation is not connected yet. Enable Vercel AI Gateway for this project; no client-side API key is required.", "AI_NOT_CONFIGURED");
  }
  const model = process.env.AI_GATEWAY_MODEL || "alibaba/qwen-3-235b";
  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You produce accurate, high-quality ecommerce listing copy and return strictly valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 3200,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(503, "Vercel did not provide an OIDC token to this function. Check the project OIDC configuration and redeploy.", "AI_AUTH_REQUIRED");
    }
    if (response.status === 402) {
      throw new ApiError(503, "The FLOW AI Gateway account needs credits or billing verification before it can generate listings.", "AI_CREDITS_REQUIRED");
    }
    throw new ApiError(502, `AI listing generation failed (${response.status}). ${details.slice(0, 240)}`, "AI_GENERATION_FAILED");
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const generated = payload.choices?.[0]?.message?.content;
  if (!generated) throw new ApiError(502, "The AI model returned an empty response. Please try again.", "AI_EMPTY_RESPONSE");
  return generated;
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
    const marketplaces = list(source.targetMarketplaces, 10);
    const legacyMarketplace = text(source.targetMarketplace);
    const selectedMarketplaces = marketplaces.length ? marketplaces : legacyMarketplace.split(/[,·]/).map((item) => item.trim()).filter(Boolean);
    const [englishRaw, arabicRaw] = await Promise.all([
      generateWithAI(buildPrompt(source, "en", selectedMarketplaces), request),
      generateWithAI(buildPrompt(source, "ar", selectedMarketplaces), request),
    ]);
    const generated = {
      en: parseListing(englishRaw, "en"),
      ar: parseListing(arabicRaw, "ar"),
    };
    for (const locale of ["en", "ar"] as const) {
      const listing = generated[locale];
      const combined = [listing.title, listing.shortDescription, listing.fullDescription, ...listing.bulletPoints].join(" ").toLowerCase();
      const forbidden = ["brand:", "category:", "product type:", "العلامة التجارية:", "الفئة:", "نوع المنتج:", "online shopping", "product listing"];
      const metadataDump = forbidden.some((phrase) => combined.includes(phrase));
      const wordCount = listing.fullDescription.split(/\s+/).filter(Boolean).length;
      if (listing.title.length < 12 || listing.shortDescription.length < 45 || wordCount < 35 || listing.bulletPoints.length < 3 || listing.keywords.length < 5 || metadataDump) {
        throw new ApiError(422, locale === "ar"
          ? "المعلومات المتاحة عن المنتج غير كافية لإنتاج Listing احترافي. أضيفي وصفًا ومميزات ومواصفات مؤكدة للمنتج ثم أعيدي المحاولة."
          : "There is not enough verified product information to create a professional listing. Add a product description, real features and confirmed specifications, then try again.", "INSUFFICIENT_PRODUCT_INFORMATION");
      }
    }
    return NextResponse.json({ generated, generator: "vercel_ai_gateway", model: process.env.AI_GATEWAY_MODEL || "alibaba/qwen-3-235b" });
  } catch (error) {
    return apiError(error);
  }
}
