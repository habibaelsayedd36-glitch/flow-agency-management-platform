import { db } from "@/db";
import { marketplaces, serviceCatalog } from "@/db/schema";

export async function ensureFlowCatalog() {
  await db
    .insert(serviceCatalog)
    .values([
      {
        slug: "product-photography",
        name: "Product photography",
        description: "Professional studio product photography prepared for online marketplaces.",
        unitType: "per_item",
        price: 30,
        priceLabel: "Public reference · per item",
        sortOrder: 1,
      },
      {
        slug: "bilingual-listing",
        name: "Bilingual listing content",
        description: "Arabic and English listing copy with marketplace SEO optimization.",
        unitType: "per_item",
        price: 10,
        priceLabel: "Public reference · per item",
        sortOrder: 2,
      },
      {
        slug: "photography-listing-bundle",
        name: "Photography + listing",
        description: "Studio photography with bilingual SEO listing content, ready for marketplace review.",
        unitType: "per_item",
        price: 35,
        priceLabel: "Public reference · per item",
        sortOrder: 3,
      },
      {
        slug: "marketplace-account-management",
        name: "Marketplace account management",
        description: "Ongoing seller-account and catalog support for the marketplaces FLOW works with.",
        unitType: "monthly",
        price: 3500,
        priceLabel: "Public starting reference · monthly",
        sortOrder: 4,
      },
    ])
    .onConflictDoNothing({ target: serviceCatalog.slug });

  await db
    .insert(marketplaces)
    .values([
      { slug: "amazon", name: "Amazon" },
      { slug: "noon", name: "Noon" },
      { slug: "jumia", name: "Jumia" },
      { slug: "shopify", name: "Shopify" },
      { slug: "instashop", name: "InstaShop" },
    ])
    .onConflictDoNothing({ target: marketplaces.slug });
}
