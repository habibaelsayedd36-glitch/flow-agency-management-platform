import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceAccounts, marketplaceListings, marketplaces, products } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { ensureFlowCatalog } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    await ensureFlowCatalog();
    const marketplaceRows = await db.select().from(marketplaces).where(eq(marketplaces.isEnabled, true));
    const accountRows = user.role === "client" && user.organizationId
      ? await db.select().from(marketplaceAccounts).where(eq(marketplaceAccounts.organizationId, user.organizationId))
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select().from(marketplaceAccounts)
        : [];
    const listings = user.role === "client" && user.organizationId
      ? await db.select({ listing: marketplaceListings, productName: products.name, marketplaceName: marketplaces.name }).from(marketplaceListings)
          .innerJoin(products, eq(marketplaceListings.productId, products.id))
          .innerJoin(marketplaces, eq(marketplaceListings.marketplaceId, marketplaces.id))
          .where(eq(products.organizationId, user.organizationId)).orderBy(desc(marketplaceListings.updatedAt)).limit(100)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select({ listing: marketplaceListings, productName: products.name, marketplaceName: marketplaces.name }).from(marketplaceListings)
            .innerJoin(products, eq(marketplaceListings.productId, products.id))
            .innerJoin(marketplaces, eq(marketplaceListings.marketplaceId, marketplaces.id)).orderBy(desc(marketplaceListings.updatedAt)).limit(200)
        : [];
    return NextResponse.json({
      marketplaces: marketplaceRows.map((marketplace) => ({
        ...marketplace,
        account: accountRows.find((account) => account.marketplaceId === marketplace.id) ?? null,
        connectionStatus: accountRows.find((account) => account.marketplaceId === marketplace.id)?.connectionStatus ?? "not_connected",
      })),
      listings,
      integrationsEnabled: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
