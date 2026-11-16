import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, projectMembers, projects, users, workflowSteps } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);

    let productScope;
    let projectScope;
    if (user.role === "client") {
      productScope = user.organizationId ? eq(products.organizationId, user.organizationId) : sql`false`;
      projectScope = user.organizationId ? eq(projects.organizationId, user.organizationId) : sql`false`;
    } else if (user.role === "admin" || user.role === "production_manager") {
      productScope = undefined;
      projectScope = undefined;
    } else if (user.role === "account_manager") {
      const assigned = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
      const orgIds = [...new Set(assigned.map((row) => row.organizationId))];
      productScope = orgIds.length ? inArray(products.organizationId, orgIds) : sql`false`;
      projectScope = assigned.length ? inArray(projects.organizationId, orgIds) : sql`false`;
    } else {
      const [assignedSteps, memberships] = await Promise.all([
        db.select({ productId: workflowSteps.productId }).from(workflowSteps).where(eq(workflowSteps.assignedTo, user.id)),
        db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, user.id)),
      ]);
      const ids = assignedSteps.map((row) => row.productId);
      const projectIds = memberships.map((row) => row.projectId);
      productScope = ids.length ? inArray(products.id, ids) : sql`false`;
      projectScope = projectIds.length ? inArray(projects.id, projectIds) : sql`false`;
    }

    const productRows = productScope
      ? await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).where(productScope).limit(500)
      : await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).limit(500);
    const productIds = productRows.map((row) => row.id);
    const productMap = new Map(productRows.map((row) => [row.id, row]));
    const projectRows = projectScope
      ? await db.select({ id: projects.id, name: projects.name, projectCode: projects.projectCode, dueDate: projects.dueDate, status: projects.status, priority: projects.priority }).from(projects).where(and(projectScope, isNotNull(projects.dueDate))).orderBy(asc(projects.dueDate)).limit(300)
      : await db.select({ id: projects.id, name: projects.name, projectCode: projects.projectCode, dueDate: projects.dueDate, status: projects.status, priority: projects.priority }).from(projects).where(isNotNull(projects.dueDate)).orderBy(asc(projects.dueDate)).limit(300);

    const stepRows = productIds.length
      ? await db.select({
          id: workflowSteps.id,
          productId: workflowSteps.productId,
          stageLabel: workflowSteps.stageLabel,
          status: workflowSteps.status,
          deadline: workflowSteps.deadline,
          assignedTo: workflowSteps.assignedTo,
          clientVisible: workflowSteps.clientVisible,
        }).from(workflowSteps)
          .where(and(inArray(workflowSteps.productId, productIds), isNotNull(workflowSteps.deadline), user.role === "client" ? eq(workflowSteps.clientVisible, true) : undefined))
          .orderBy(asc(workflowSteps.deadline)).limit(600)
      : [];

    const events = [
      ...projectRows.map((project) => ({
        id: `project:${project.id}`,
        title: project.name,
        date: project.dueDate,
        kind: "project",
        status: project.status,
        priority: project.priority,
        reference: project.projectCode,
        href: "projects",
      })),
      ...stepRows.filter((step) => step.status !== "completed").map((step) => ({
        id: `step:${step.id}`,
        title: `${productMap.get(step.productId)?.name || "Product"} · ${step.stageLabel}`,
        date: step.deadline,
        kind: "task",
        status: step.status,
        reference: productMap.get(step.productId)?.sku || "",
        productId: step.productId,
        assignedTo: step.assignedTo,
        href: "production",
      })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    return NextResponse.json({ events, total: events.length });
  } catch (error) {
    return apiError(error);
  }
}
