import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { apiError, assertSameOrigin, ApiError } from "@/lib/api";
import { assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "account_manager", "content_creator", "production_manager"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    const product = await assertProductAccess(user, id);
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!row) throw new ApiError(404, "Product not found.", "NOT_FOUND");
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ApiError(503, "AI content generation is not configured yet. Add OPENAI_API_KEY to the production environment.", "AI_NOT_CONFIGURED");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CONTENT_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are an expert ecommerce marketplace listing copywriter. Generate accurate, conversion-focused Arabic (natural modern Egyptian-friendly MSA) and English product listing content. Never invent specifications, certifications, dimensions, materials, guarantees, health claims or performance claims. If details are missing, omit them. Return JSON with keys en and ar; each has title, shortDescription, fullDescription, bulletPoints (array), keywords (array). Keep keywords appropriate for marketplace search. Avoid keyword stuffing." },
          { role: "user", content: JSON.stringify({ name: row.name, sku: row.sku, brand: row.brand, category: row.category, productType: row.productType, description: row.description, specifications: row.specifications, dimensions: row.dimensions, weight: row.weight, materials: row.materials, targetAudience: row.targetAudience, marketplace: row.targetMarketplace, clientInstructions: row.clientInstructions }) }
        ],
        temperature: 0.4
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new ApiError(502, payload.error?.message || "AI provider could not generate listing content.", "AI_PROVIDER_ERROR");
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) throw new ApiError(502, "AI provider returned an empty response.", "AI_EMPTY_RESPONSE");
    const generated = JSON.parse(raw);
    for (const locale of ["en", "ar"] as const) {
      const content = generated[locale];
      if (!content || typeof content.title !== "string" || !content.title.trim()) throw new ApiError(502, "AI returned incomplete bilingual content. Please retry.", "AI_INVALID_RESPONSE");
      if (!Array.isArray(content.bulletPoints) || !Array.isArray(content.keywords)) throw new ApiError(502, "AI returned incomplete listing fields. Please retry.", "AI_INVALID_RESPONSE");
    }
    return NextResponse.json({ generated });
  } catch (error) {
    return apiError(error);
  }
}
