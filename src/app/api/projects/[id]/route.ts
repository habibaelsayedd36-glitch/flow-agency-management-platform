import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, projectMembers, projects, users } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

const statuses = ["new", "pending_review", "waiting_client", "in_progress", "on_hold", "awaiting_approval", "revision_required", "completed", "cancelled"] as const;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { id } = await context.params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    await assertOrganizationAccess(user, project.organizationId);
    const [projectProducts, members] = await Promise.all([
      db.select().from(products).where(eq(products.projectId, id)),
      db.select({ member: projectMembers, fullName: users.fullName, role: users.role }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, id)),
    ]);
    const safeProject = user.role === "client" ? { ...project, budget: null } : project;
    return NextResponse.json({ project: safeProject, products: projectProducts.map((item) => user.role === "client" ? { ...item, internalNotes: null } : item), members });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    await assertOrganizationAccess(user, project.organizationId);
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (user.role === "client") {
      if (!["new", "pending_review"].includes(project.status)) return NextResponse.json({ error: "This project has moved into production and can no longer be edited here." }, { status: 409 });
      if (body.name !== undefined) updates.name = requireText(body.name, "Project name", 180);
      if (body.description !== undefined) updates.description = optionalText(body.description, 4000);
    } else {
      if (body.name !== undefined) updates.name = requireText(body.name, "Project name", 180);
      if (body.description !== undefined) updates.description = optionalText(body.description, 4000);
      if (body.status !== undefined && statuses.includes(body.status)) updates.status = body.status;
      if (body.priority !== undefined && ["low", "normal", "high", "urgent"].includes(body.priority)) updates.priority = body.priority;
      if (body.dueDate !== undefined) updates.dueDate = typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
      if (body.progress !== undefined && Number.isInteger(body.progress) && body.progress >= 0 && body.progress <= 100) updates.progress = body.progress;
      if (body.accountManagerId !== undefined && ["admin", "production_manager"].includes(user.role)) updates.accountManagerId = body.accountManagerId || null;
    }
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: "No supported changes were provided." }, { status: 400 });
    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    if (updates.status && updates.status !== project.status) {
      await writeActivity({ actorId: user.id, organizationId: project.organizationId, entityType: "project", entityId: id, action: "project.status_changed", description: `Project “${project.name}” moved to ${String(updates.status).replaceAll("_", " ")}.`, visibility: "client" });
    }
    await writeAudit({ actorId: user.id, organizationId: project.organizationId, action: "project.updated", entityType: "project", entityId: id, previousValue: { status: project.status }, newValue: { status: updated.status } });
    return NextResponse.json({ project: updated });
  } catch (error) {
    return apiError(error);
  }
}
