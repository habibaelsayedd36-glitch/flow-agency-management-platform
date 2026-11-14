import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

const projectStatuses = ["new", "pending_review", "waiting_client", "in_progress", "on_hold", "awaiting_approval", "revision_required", "completed", "cancelled"] as const;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    let where;
    if (user.role === "client") where = user.organizationId ? eq(projects.organizationId, user.organizationId) : undefined;
    else if (user.role === "admin" || user.role === "production_manager") where = undefined;
    else if (user.role === "account_manager") where = eq(projects.accountManagerId, user.id);
    else {
      const memberRows = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, user.id));
      where = memberRows.length ? inArray(projects.id, memberRows.map((row) => row.projectId)) : undefined;
    }
    const rows = where ? await db.select().from(projects).where(where).orderBy(desc(projects.updatedAt)).limit(250) : user.role === "admin" || user.role === "production_manager" ? await db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(250) : [];
    return NextResponse.json({ projects: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const body = await request.json();
    const organizationId = user.role === "client" ? user.organizationId : requireText(body.organizationId, "Workspace", 80);
    if (!organizationId) return NextResponse.json({ error: "A client workspace is required." }, { status: 400 });
    await assertOrganizationAccess(user, organizationId);
    const name = requireText(body.name, "Project name", 180);
    const status = user.role === "client" ? "pending_review" : projectStatuses.includes(body.status) ? body.status : "new";
    const dueDate = typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
    const managerId = ["admin", "account_manager", "production_manager"].includes(user.role) && typeof body.accountManagerId === "string" ? body.accountManagerId : null;
    const projectCode = `FL-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [project] = await db.insert(projects).values({
      organizationId,
      projectCode,
      name,
      description: optionalText(body.description, 4000),
      status,
      priority: ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal",
      dueDate,
      accountManagerId: managerId,
      createdBy: user.id,
      progress: 0,
    }).returning();
    if (managerId) {
      await db.insert(projectMembers).values({ projectId: project.id, userId: managerId, memberRole: "account_manager", assignedBy: user.id }).onConflictDoNothing();
    }
    await writeActivity({ actorId: user.id, organizationId, entityType: "project", entityId: project.id, action: "project.created", description: user.role === "client" ? `Project request “${name}” was submitted.` : `Project “${name}” was created.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId, action: "project.created", entityType: "project", entityId: project.id, newValue: { name, status, projectCode } });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
