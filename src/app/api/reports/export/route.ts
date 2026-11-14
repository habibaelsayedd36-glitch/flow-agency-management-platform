import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

function csv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const startRaw = request.nextUrl.searchParams.get("start");
    const endRaw = request.nextUrl.searchParams.get("end");
    const start = startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? new Date(`${startRaw}T00:00:00.000Z`) : null;
    const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? new Date(`${endRaw}T23:59:59.999Z`) : null;
    const rows = await db.select().from(products).where(and(
      user.role === "client" && user.organizationId ? eq(products.organizationId, user.organizationId) : undefined,
      start ? gte(products.createdAt, start) : undefined,
      end ? lte(products.createdAt, end) : undefined,
    )).orderBy(desc(products.createdAt)).limit(5000);
    const header = ["Name", "SKU", "Brand", "Category", "Marketplace", "Status", "Submitted at"];
    const content = [header, ...rows.map((row) => [row.name, row.sku, row.brand, row.category, row.targetMarketplace, row.status, row.createdAt.toISOString()])].map((row) => row.map(csv).join(",")).join("\r\n");
    return new NextResponse(`\uFEFF${content}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=flow-products-report.csv", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
