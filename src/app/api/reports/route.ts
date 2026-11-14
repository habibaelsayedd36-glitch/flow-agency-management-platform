import { and, count, desc, eq, gte, inArray, lte, sum } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { approvals, invoices, marketplaceListings, products, projects, serviceRequests } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

function dateFilter(params: URLSearchParams) {
  const startRaw = params.get("start");
  const endRaw = params.get("end");
  const start = startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? new Date(`${startRaw}T00:00:00.000Z`) : null;
  const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? new Date(`${endRaw}T23:59:59.999Z`) : null;
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { start, end } = dateFilter(request.nextUrl.searchParams);
    const orgFilter = user.role === "client" && user.organizationId ? eq(products.organizationId, user.organizationId) : undefined;
    const projectFilter = user.role === "client" && user.organizationId ? eq(projects.organizationId, user.organizationId) : undefined;
    const requestFilter = user.role === "client" && user.organizationId ? eq(serviceRequests.organizationId, user.organizationId) : undefined;
    const invoiceFilter = user.role === "client" && user.organizationId ? eq(invoices.organizationId, user.organizationId) : undefined;
    const productFilter = and(orgFilter, start ? gte(products.createdAt, start) : undefined, end ? lte(products.createdAt, end) : undefined);
    const projectDate = and(projectFilter, start ? gte(projects.createdAt, start) : undefined, end ? lte(projects.createdAt, end) : undefined);
    const requestDate = and(requestFilter, start ? gte(serviceRequests.createdAt, start) : undefined, end ? lte(serviceRequests.createdAt, end) : undefined);
    const invoiceDate = and(invoiceFilter, start ? gte(invoices.createdAt, start) : undefined, end ? lte(invoices.createdAt, end) : undefined);
    const [productTotal] = await db.select({ total: count() }).from(products).where(productFilter);
    const productBreakdown = await db.select({ status: products.status, total: count() }).from(products).where(productFilter).groupBy(products.status);
    const [projectTotal] = await db.select({ total: count() }).from(projects).where(projectDate);
    const projectBreakdown = await db.select({ status: projects.status, total: count() }).from(projects).where(projectDate).groupBy(projects.status);
    const [requestTotal] = await db.select({ total: count() }).from(serviceRequests).where(requestDate);
    const [approvalTotal] = await db.select({ total: count() }).from(approvals).where(user.role === "client" && user.organizationId ? and(eq(approvals.organizationId, user.organizationId), eq(approvals.status, "pending")) : undefined);
    const listings = user.role === "client" && user.organizationId
      ? await db.select({ status: marketplaceListings.status, total: count() }).from(marketplaceListings).innerJoin(products, eq(marketplaceListings.productId, products.id)).where(eq(products.organizationId, user.organizationId)).groupBy(marketplaceListings.status)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select({ status: marketplaceListings.status, total: count() }).from(marketplaceListings).groupBy(marketplaceListings.status)
        : [];
    const [billing] = await db.select({ total: sum(invoices.total), paid: sum(invoices.amountPaid), count: count() }).from(invoices).where(invoiceDate);
    return NextResponse.json({
      range: { start: start?.toISOString() ?? null, end: end?.toISOString() ?? null },
      products: { total: productTotal?.total ?? 0, byStatus: productBreakdown },
      projects: { total: projectTotal?.total ?? 0, byStatus: projectBreakdown },
      serviceRequests: requestTotal?.total ?? 0,
      pendingApprovals: approvalTotal?.total ?? 0,
      marketplaceListings: listings,
      billing: { invoices: billing?.count ?? 0, billed: Number(billing?.total ?? 0), paid: Number(billing?.paid ?? 0) },
    });
  } catch (error) {
    return apiError(error);
  }
}
