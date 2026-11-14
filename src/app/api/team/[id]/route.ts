import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

const staffRoles = ["account_manager", "photographer", "content_creator", "production_manager"] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const { id } = await context.params;
    const [previous] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!previous || previous.role === "client" || previous.role === "admin") return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.fullName !== undefined && typeof body.fullName === "string" && body.fullName.trim()) updates.fullName = body.fullName.trim().slice(0, 140);
    if (body.status !== undefined && ["active", "disabled", "suspended"].includes(body.status)) updates.status = body.status;
    if (body.role !== undefined && staffRoles.includes(body.role)) updates.role = body.role;
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (body.department !== undefined || body.title !== undefined || body.phone !== undefined) {
      await db.insert(employees).values({ userId: id, department: optionalText(body.department, 100), title: optionalText(body.title, 120), phone: optionalText(body.phone, 40) }).onConflictDoUpdate({ target: employees.userId, set: { department: optionalText(body.department, 100), title: optionalText(body.title, 120), phone: optionalText(body.phone, 40), updatedAt: new Date() } });
    }
    await writeAudit({ actorId: admin.id, action: "employee.updated", entityType: "user", entityId: id, previousValue: { role: previous.role, status: previous.status }, newValue: { role: updated.role, status: updated.status } });
    return NextResponse.json({ member: { ...updated, passwordHash: undefined } });
  } catch (error) {
    return apiError(error);
  }
}
