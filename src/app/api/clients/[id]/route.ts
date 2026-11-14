import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, projects, users } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

const statuses = ["pending", "active", "suspended", "disabled"] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const { id } = await context.params;
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!organization) return NextResponse.json({ error: "Client workspace not found." }, { status: 404 });
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined && statuses.includes(body.status)) updates.status = body.status;
    for (const field of ["companyName", "contactPerson"] as const) {
      if (body[field] !== undefined) updates[field] = requireText(body[field], field === "companyName" ? "Company name" : "Contact name", field === "companyName" ? 180 : 140);
    }
    if (body.phone !== undefined) updates.phone = optionalText(body.phone, 40);
    if (body.category !== undefined) updates.category = optionalText(body.category, 120);
    if (body.website !== undefined) updates.website = optionalText(body.website, 300);
    if (Object.keys(updates).length === 1 && body.accountManagerId === undefined) return NextResponse.json({ error: "No supported changes were provided." }, { status: 400 });
    const [updated] = await db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
    if (body.status !== undefined && statuses.includes(body.status)) {
      await db.update(users).set({ status: body.status, ...(body.verifyManually === true && body.status === "active" ? { emailVerifiedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(users.organizationId, id));
    }
    if (body.accountManagerId !== undefined) {
      const managerId = body.accountManagerId ? requireText(body.accountManagerId, "Account manager", 80) : null;
      if (managerId) {
        const [manager] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(and(eq(users.id, managerId), eq(users.role, "account_manager"))).limit(1);
        if (!manager || manager.status !== "active") return NextResponse.json({ error: "Choose an active account manager." }, { status: 400 });
      }
      await db.update(projects).set({ accountManagerId: managerId, updatedAt: new Date() }).where(eq(projects.organizationId, id));
    }
    await writeAudit({ actorId: admin.id, organizationId: id, action: body.status === "active" && body.verifyManually === true ? "client.manually_verified_and_activated" : "client.updated", entityType: "organization", entityId: id, previousValue: { status: organization.status }, newValue: { status: updated.status, accountManagerId: body.accountManagerId ?? undefined } });
    return NextResponse.json({ organization: updated });
  } catch (error) {
    return apiError(error);
  }
}
