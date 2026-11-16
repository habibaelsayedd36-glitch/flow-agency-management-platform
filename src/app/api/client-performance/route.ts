import { asc, count, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceListings, marketplaces, organizations, products, projects } from "@/db/schema";
import { apiError } from "@/lib/api";
import { canAccessOrganization, requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "production_manager", "account_manager"]);
    requireActiveAccount(user);
    const orgs = await db.select().from(organizations).where(eq(organizations.status, "active")).orderBy(asc(organizations.companyName)).limit(500);
    const visible = user.role === "admin" || user.role === "production_manager" ? orgs : (await Promise.all(orgs.map(async (org) => await canAccessOrganization(user, org.id) ? org : null))).filter(Boolean) as typeof orgs;
    const ids = visible.map((org) => org.id);
    if (!ids.length) return NextResponse.json({ clients: [], summary: { clients: 0, products: 0, published: 0, marketplaces: 0 } });
    const productRows = await db.select({ id: products.id, organizationId: products.organizationId, status: products.status, targetMarketplace: products.targetMarketplace }).from(products).where(inArray(products.organizationId, ids)).limit(5000);
    const productIds = productRows.map((item) => item.id);
    const listingRows = productIds.length ? await db.select({ productId: marketplaceListings.productId, status: marketplaceListings.status, marketplaceName: marketplaces.name }).from(marketplaceListings).innerJoin(marketplaces, eq(marketplaceListings.marketplaceId, marketplaces.id)).where(inArray(marketplaceListings.productId, productIds)) : [];
    const clients = visible.map((org) => {
      const items = productRows.filter((product) => product.organizationId === org.id);
      const idsForClient = new Set(items.map((item) => item.id));
      const listings = listingRows.filter((listing) => idsForClient.has(listing.productId));
      const targets = new Set<string>([...(org.targetMarketplaces || []), ...items.flatMap((item) => (item.targetMarketplace || "").split(/[,;|]/).map((name) => name.trim()).filter(Boolean)), ...listings.map((item) => item.marketplaceName)]);
      return { id: org.id, name: org.companyName, category: org.category, products: items.length, published: items.filter((item) => item.status === "published" || item.status === "completed").length, inProduction: items.filter((item) => !["published", "completed", "cancelled"].includes(item.status)).length, marketplaces: [...targets], listings: listings.length, liveListings: listings.filter((item) => item.status === "published").length, statusBreakdown: Object.entries(items.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {})).map(([status, total]) => ({ status, total })) };
    });
    return NextResponse.json({ clients, summary: { clients: clients.length, products: productRows.length, published: productRows.filter((item) => item.status === "published" || item.status === "completed").length, marketplaces: new Set(clients.flatMap((client) => client.marketplaces)).size } });
  } catch (error) { return apiError(error); }
}
