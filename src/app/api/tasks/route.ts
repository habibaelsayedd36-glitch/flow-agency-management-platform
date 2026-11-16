import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, projects, users, workflowSteps } from "@/db/schema";
import { apiError, assertSameOrigin } from "@/lib/api";
import { assertProductAccess, canManageWork, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

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
      priority: workflowSteps.priority,
      deadline: workflowSteps.deadline,
      assignedTo: workflowSteps.assignedTo,
      assignedName: users.fullName,
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

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "production_manager", "account_manager"]);
    requireActiveAccount(user);
    if (!canManageWork(user)) return NextResponse.json({ error: "You cannot manage workflow assignments." }, { status: 403 });
    const body = await request.json();
    if (typeof body.id !== "string") return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
    const [step] = await db.select().from(workflowSteps).where(eq(workflowSteps.id, body.id)).limit(1);
    if (!step) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const product = await assertProductAccess(user, step.productId);
    const patch: Partial<typeof workflowSteps.$inferInsert> = {};
    if (body.priority !== undefined) {
      if (!["low", "normal", "high", "urgent"].includes(body.priority)) return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
      patch.priority = body.priority;
    }
    if (body.assignedTo !== undefined) {
      if (body.assignedTo !== null && typeof body.assignedTo !== "string") return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
      if (body.assignedTo) {
        const [assignee] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, body.assignedTo), eq(users.status, "active"), inArray(users.role, ["admin", "production_manager", "account_manager", "photographer", "content_creator"]))).limit(1);
        if (!assignee) return NextResponse.json({ error: "Choose an active FLOW team member." }, { status: 400 });
      }
      patch.assignedTo = body.assignedTo;
    }
    if (body.deadline !== undefined) {
      if (body.deadline === null || body.deadline === "") patch.deadline = null;
      else {
        const parsed = new Date(body.deadline);
        if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Invalid deadline." }, { status: 400 });
        patch.deadline = parsed;
      }
    }
    if (body.status !== undefined) {
      if (!["pending", "in_progress", "complete"].includes(body.status)) return NextResponse.json({ error: "Invalid task status." }, { status: 400 });
      patch.status = body.status;
      patch.completedAt = body.status === "complete" ? new Date() : null;
      patch.startedAt = body.status === "in_progress" ? (step.startedAt || new Date()) : step.startedAt;
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "No task changes were provided." }, { status: 400 });
    const [updated] = await db.update(workflowSteps).set(patch).where(eq(workflowSteps.id, step.id)).returning();
    await writeActivity({ actorId: user.id, organizationId: product.organizationId, entityType: "product", entityId: product.id, action: "workflow.task_updated", description: `Workflow task “${step.stageLabel}” was updated.`, visibility: "internal" });
    await writeAudit({ actorId: user.id, organizationId: product.organizationId, action: "workflow.task_updated", entityType: "workflow_step", entityId: step.id, oldValue: { priority: step.priority, assignedTo: step.assignedTo, deadline: step.deadline, status: step.status }, newValue: patch });
    return NextResponse.json({ task: updated });
  } catch (error) {
    return apiError(error);
  }
}
