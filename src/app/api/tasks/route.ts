import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, projects, users, workflowSteps } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "production_manager", "account_manager", "photographer", "content_creator"]);
    requireActiveAccount(user);

    let conditions = [ne(workflowSteps.status, "complete")];
    if (user.role === "account_manager") {
      const assignedProjects = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
      const orgIds = [...new Set(assignedProjects.map((row) => row.organizationId))];
      conditions.push(orgIds.length ? inArray(products.organizationId, orgIds) : eq(products.id, "00000000-0000-0000-0000-000000000000"));
    } else if (user.role === "photographer" || user.role === "content_creator") {
      conditions.push(eq(workflowSteps.assignedTo, user.id));
    }

    const rows = await db.select({
      id: workflowSteps.id,
      productId: workflowSteps.productId,
      stageKey: workflowSteps.stageKey,
      stageLabel: workflowSteps.stageLabel,
      status: workflowSteps.status,
      deadline: workflowSteps.deadline,
      assignedTo: workflowSteps.assignedTo,
      assignedName: users.name,
      clientVisible: workflowSteps.clientVisible,
      productName: products.name,
      sku: products.sku,
      brand: products.brand,
      organizationId: products.organizationId,
    }).from(workflowSteps)
      .innerJoin(products, eq(workflowSteps.productId, products.id))
      .leftJoin(users, eq(workflowSteps.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(asc(workflowSteps.deadline), asc(workflowSteps.stageOrder))
      .limit(800);

    const now = new Date();
    const tasks = rows.map((row) => ({
      ...row,
      overdue: Boolean(row.deadline && new Date(row.deadline).getTime() < now.getTime() && row.status !== "complete"),
      unassigned: !row.assignedTo,
    }));
    return NextResponse.json({
      tasks,
      summary: {
        total: tasks.length,
        overdue: tasks.filter((task) => task.overdue).length,
        unassigned: tasks.filter((task) => task.unassigned).length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        pending: tasks.filter((task) => task.status === "pending").length,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
