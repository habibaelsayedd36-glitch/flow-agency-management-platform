import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceListings, marketplaces, products } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

const statuses = ["not_published", "draft", "ready_for_publishing", "pending", "published", "rejected", "needs_attention"] as const;

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const body = await request.json();
    const productId = requireText(body.productId, "Product", 80);
    const product = await assertProductAccess(user, productId);
    const marketplaceId = requireText(body.marketplaceId, "Marketplace", 80);
    const [marketplace] = await db.select().from(marketplaces).where(and(eq(marketplaces.id, marketplaceId), eq(marketplaces.isEnabled, true))).limit(1);
    if (!marketplace) return NextResponse.json({ error: "Marketplace not found." }, { status: 404 });
    const status = statuses.includes(body.status) ? body.status : null;
    if (!status) throw new ApiError(400, "Choose a valid listing status.", "VALIDATION_ERROR");
    const listingId = optionalText(body.listingId, 180);
    const listingUrl = optionalText(body.listingUrl, 1000);
    if (listingUrl) {
      let parsed: URL;
      try { parsed = new URL(listingUrl); } catch { throw new ApiError(400, "Enter a valid marketplace URL.", "VALIDATION_ERROR"); }
      if (parsed.protocol !== "https:") throw new ApiError(400, "Marketplace links must use HTTPS.", "VALIDATION_ERROR");
    }
    if (status === "published" && (!listingId || !listingUrl)) throw new ApiError(400, "A listing ID and HTTPS product URL are required before marking an item published.", "PUBLISHING_EVIDENCE_REQUIRED");
    const existing = await db.select({ id: marketplaceListings.id }).from(marketplaceListings).where(and(eq(marketplaceListings.productId, productId), eq(marketplaceListings.marketplaceId, marketplaceId))).limit(1);
    const writeValues = {
      listingId,
      listingUrl,
      status,
      publishedAt: status === "published" ? new Date() : null,
      errorMessage: optionalText(body.errorMessage, 2000),
      updatedBy: user.id,
      updatedAt: new Date(),
    };
    const [listing] = existing.length
      ? await db.update(marketplaceListings).set(writeValues).where(eq(marketplaceListings.id, existing[0].id)).returning()
      : await db.insert(marketplaceListings).values({ productId, marketplaceId, ...writeValues }).returning();
    if (status === "published") await db.update(products).set({ status: "published", updatedAt: new Date() }).where(eq(products.id, productId));
    await writeActivity({ actorId: user.id, organizationId: product.organizationId, entityType: "marketplace_listing", entityId: listing.id, action: "marketplace_listing.manually_updated", description: `${product.name} listing status for ${marketplace.name} was manually set to ${status.replaceAll("_", " ")}.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId: product.organizationId, action: "marketplace_listing.manually_updated", entityType: "marketplace_listing", entityId: listing.id, newValue: { marketplace: marketplace.slug, status, listingId, listingUrl, source: "manual" } });
    return NextResponse.json({ listing, source: "manual" }, { status: existing.length ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
