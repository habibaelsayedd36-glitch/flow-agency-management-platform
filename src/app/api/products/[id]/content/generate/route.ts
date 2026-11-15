import { NextRequest, NextResponse } from "next/server";
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
Write a genuinely useful, conversion-focused marketplace listing in ${language}.

SOURCE OF TRUTH — use only the supplied product facts. Never invent ingredients, materials, sizes, compatibility, certifications, origin, performance, clinical/health claims, guarantees, awards, or benefits. Do not infer facts from a brand or product name. If information is missing, leave that claim out and list the missing information.
Do not repeat field labels as bullet points. Do not pad copy with generic phrases such as "shop now", "high quality", "online shopping", or "product listing".
Make the title readable and search-friendly without keyword stuffing. Make each bullet distinct and useful. Write a coherent full description, not a restatement of metadata. Include relevant search terms naturally and avoid competitor brands.
Selected marketplaces: ${marketplaces.join(", ") || "Not specified"}. Respect common marketplace listing conventions, but do not claim exact platform compliance where category-specific rules are unknown.
Return ONLY valid JSON with this exact shape:
{"title":"...","shortDescription":"...","fullDescription":"...","bulletPoints":["..."],"keywords":["..."],"qualityScore":0,"missingInformation":["..."]}
qualityScore is an honest 0–100 score for the completeness and usefulness of the listing based on supplied facts; lower it when essential product details are absent. missingInformation contains specific facts the client should supply, or [] if none.
Product facts:
${JSON.stringify(facts)}`;
}

async function generateWithAI(prompt: string, request: NextRequest): Promise<string> {
  const token = process.env.AI_GATEWAY_API_KEY || request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN;
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
      temperature: 0.65,
      max_tokens: 2400,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(503, "Vercel AI Gateway authentication is not enabled for this deployment yet.", "AI_AUTH_REQUIRED");
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
    return NextResponse.json({ generated, generator: "vercel_ai_gateway", model: process.env.AI_GATEWAY_MODEL || "alibaba/qwen-3-235b" });
  } catch (error) {
    return apiError(error);
  }
}
