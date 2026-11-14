import { and, count, desc, eq, inArray, or, sql, sum } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activityLogs, approvals, invoices, products, projectMembers, projects, serviceRequests, users, workflowSteps } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireAuth, requireActiveAccount } from "@/lib/authorization";

type DashboardScope = { projectIds: string[] | null; organizationIds: string[] | null; productIds: string[] | null };

async function getDashboardScope(user: Awaited<ReturnType<typeof requireAuth>>): Promise<DashboardScope> {
  if (user.role === "client") return { projectIds: null, organizationIds: user.organizationId ? [user.organizationId] : [], productIds: null };
  if (user.role === "admin" || user.role === "production_manager") return { projectIds: null, organizationIds: null, productIds: null };
  if (user.role === "account_manager") {
    const rows = await db.select({ id: projects.id, organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
    return { projectIds: rows.map((row) => row.id), organizationIds: [...new Set(rows.map((row) => row.organizationId))], productIds: null };
  }
  const [memberRows, assignedRows] = await Promise.all([
    db.select({ id: projects.id, organizationId: projects.organizationId }).from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id)).where(eq(projectMembers.userId, user.id)),
    db.select({ productId: workflowSteps.productId }).from(workflowSteps).where(eq(workflowSteps.assignedTo, user.id)),
  ]);
  const productRows = assignedRows.length
    ? await db.select({ id: products.id, organizationId: products.organizationId }).from(products).where(inArray(products.id, assignedRows.map((row) => row.productId)))
    : [];
  return {
    projectIds: memberRows.map((row) => row.id),
    organizationIds: [...new Set([...memberRows.map((row) => row.organizationId), ...productRows.map((row) => row.organizationId)])],
    productIds: productRows.map((row) => row.id),
  };
}

function projectCondition(user: Awaited<ReturnType<typeof requireAuth>>, scope: DashboardScope) {
  if (user.role === "client") return user.organizationId ? eq(projects.organizationId, user.organizationId) : sql`false`;
  if (scope.projectIds === null) return undefined;
  return scope.projectIds.length ? inArray(projects.id, scope.projectIds) : sql`false`;
}

function productCondition(user: Awaited<ReturnType<typeof requireAuth>>, scope: DashboardScope) {
  if (user.role === "client") return user.organizationId ? eq(products.organizationId, user.organizationId) : sql`false`;
  if (user.role === "admin" || user.role === "production_manager") return undefined;
  if (user.role === "account_manager") return scope.organizationIds?.length ? inArray(products.organizationId, scope.organizationIds) : sql`false`;
  const conditions = [
    scope.projectIds?.length ? inArray(products.projectId, scope.projectIds) : undefined,
    scope.productIds?.length ? inArray(products.id, scope.productIds) : undefined,
  ].filter(Boolean);
  return conditions.length ? or(...conditions) : sql`false`;
}


export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.status === "pending" || user.organizationStatus === "pending") {
      return NextResponse.json({ pendingApproval: true, stats: null, projects: [], activity: [], user });
    }
    requireActiveAccount(user);
    const scope = await getDashboardScope(user);
    const productWhere = productCondition(user, scope);
    const projectWhere = projectCondition(user, scope);
    const invoiceWhere = user.role === "client"
      ? user.organizationId ? eq(invoices.organizationId, user.organizationId) : sql`false`
      : user.role === "admin" || user.role === "production_manager"
        ? undefined
        : user.role === "account_manager" && scope.organizationIds?.length
          ? inArray(invoices.organizationId, scope.organizationIds)
          : sql`false`;
    const approvalWhere = user.role === "client"
      ? user.organizationId ? eq(approvals.organizationId, user.organizationId) : sql`false`
      : user.role === "admin" || user.role === "production_manager"
        ? undefined
        : user.role === "account_manager" && scope.organizationIds?.length
          ? inArray(approvals.organizationId, scope.organizationIds)
          : sql`false`;
    const serviceWhere = user.role === "client"
      ? user.organizationId ? eq(serviceRequests.organizationId, user.organizationId) : sql`false`
      : user.role === "admin" || user.role === "production_manager"
        ? undefined
        : user.role === "account_manager" && scope.organizationIds?.length
          ? inArray(serviceRequests.organizationId, scope.organizationIds)
          : sql`false`;
    const activeRequestStatuses = ["submitted", "under_review", "quotation_required", "waiting_client_approval", "approved", "in_progress"] as const;

    const [productCounts] = await db.select({ total: count() }).from(products).where(productWhere);
    const [productionCounts] = await db.select({ total: count() }).from(products).where(and(productWhere, inArray(products.status, [
      "initial_review", "waiting_information", "photography_scheduled", "photography_in_progress", "image_editing", "content_creation", "internal_quality_review",
    ])));
    const [completedCounts] = await db.select({ total: count() }).from(products).where(and(productWhere, inArray(products.status, ["completed", "published"])));
    const [approvalCounts] = await db.select({ total: count() }).from(approvals).where(and(approvalWhere, eq(approvals.status, "pending")));
    const [projectCounts] = await db.select({ total: count() }).from(projects).where(and(projectWhere, inArray(projects.status, ["new", "pending_review", "waiting_client", "in_progress", "on_hold", "awaiting_approval", "revision_required"])));
    const [requestCounts] = await db.select({ total: count() }).from(serviceRequests).where(and(serviceWhere, inArray(serviceRequests.status, activeRequestStatuses)));
    const [invoiceCounts] = await db.select({ total: count() }).from(invoices).where(and(invoiceWhere, inArray(invoices.status, ["unpaid", "partially_paid", "pending"])));

    const projectRows = projectWhere
      ? await db.select({ project: projects, accountManagerName: users.fullName }).from(projects).leftJoin(users, eq(projects.accountManagerId, users.id)).where(projectWhere).orderBy(desc(projects.updatedAt)).limit(6)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select({ project: projects, accountManagerName: users.fullName }).from(projects).leftJoin(users, eq(projects.accountManagerId, users.id)).orderBy(desc(projects.updatedAt)).limit(6)
        : [];
    const projectIds = projectRows.map((row) => row.project.id);
    const productCountsByProject = projectIds.length
      ? await db.select({ projectId: products.projectId, total: count() }).from(products).where(inArray(products.projectId, projectIds)).groupBy(products.projectId)
      : [];
    const projectProductMap = new Map(productCountsByProject.map((row) => [row.projectId, row.total]));

    const activityCondition = user.role === "client"
      ? and(user.organizationId ? eq(activityLogs.organizationId, user.organizationId) : sql`false`, eq(activityLogs.visibility, "client"))
      : user.role === "admin" || user.role === "production_manager"
        ? undefined
        : user.role === "account_manager" && scope.organizationIds?.length
          ? inArray(activityLogs.organizationId, scope.organizationIds)
          : sql`false`;
    const activityRows = activityCondition
      ? await db.select().from(activityLogs).where(activityCondition).orderBy(desc(activityLogs.createdAt)).limit(8)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(8)
        : [];

    const [outstandingAmount] = await db.select({ total: sum(invoices.total) }).from(invoices).where(and(invoiceWhere, inArray(invoices.status, ["unpaid", "partially_paid", "pending"])));
    return NextResponse.json({
      pendingApproval: false,
      user,
      stats: {
        products: productCounts?.total ?? 0,
        inProduction: productionCounts?.total ?? 0,
        completed: completedCounts?.total ?? 0,
        awaitingApproval: approvalCounts?.total ?? 0,
        activeProjects: projectCounts?.total ?? 0,
        serviceRequests: requestCounts?.total ?? 0,
        outstandingInvoices: invoiceCounts?.total ?? 0,
        outstandingAmount: Number(outstandingAmount?.total ?? 0),
      },
      projects: projectRows.map(({ project, accountManagerName }) => ({ ...project, accountManagerName, productCount: projectProductMap.get(project.id) ?? 0 })),
      activity: activityRows,
    });
  } catch (error) {
    return apiError(error);
  }
}
