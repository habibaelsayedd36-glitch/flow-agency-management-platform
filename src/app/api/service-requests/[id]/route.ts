import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

const statuses = ["submitted", "under_review", "quotation_required", "waiting_client_approval", "approved", "in_progress", "completed", "cancelled"] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    const [serviceRequest] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
    if (!serviceRequest) return NextResponse.json({ error: "Service request not found." }, { status: 404 });
    await assertOrganizationAccess(user, serviceRequest.organizationId);
    const body = await request.json();
    if (user.role === "client") {
      if (body.status !== "cancelled" || !["submitted", "under_review", "quotation_required"].includes(serviceRequest.status)) {
        return NextResponse.json({ error: "You can only cancel a request before it is approved or in production." }, { status: 403 });
      }
      const [updated] = await db.update(serviceRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(serviceRequests.id, id)).returning();
      await writeAudit({ actorId: user.id, organizationId: serviceRequest.organizationId, action: "service_request.cancelled", entityType: "service_request", entityId: id, previousValue: { status: serviceRequest.status }, newValue: { status: "cancelled" } });
      return NextResponse.json({ request: updated });
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined && statuses.includes(body.status)) updates.status = body.status;
    if (body.estimatedCost !== undefined) {
      const amount = body.estimatedCost === null || body.estimatedCost === "" ? null : Number(body.estimatedCost);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 100000000)) return NextResponse.json({ error: "Enter a valid estimate." }, { status: 400 });
      updates.estimatedCost = amount;
    }
    if (body.assignedTo !== undefined && ["admin", "production_manager"].includes(user.role)) updates.assignedTo = typeof body.assignedTo === "string" ? body.assignedTo : null;
    if (body.description !== undefined && ["admin", "account_manager"].includes(user.role)) updates.description = optionalText(body.description, 4000);
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: "No supported changes were provided." }, { status: 400 });
    const [updated] = await db.update(serviceRequests).set(updates).where(eq(serviceRequests.id, id)).returning();
    await writeActivity({ actorId: user.id, organizationId: serviceRequest.organizationId, entityType: "service_request", entityId: id, action: "service_request.updated", description: `Service request “${serviceRequest.projectName}” was updated.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId: serviceRequest.organizationId, action: "service_request.updated", entityType: "service_request", entityId: id, previousValue: { status: serviceRequest.status }, newValue: { status: updated.status } });
    return NextResponse.json({ request: updated });
  } catch (error) {
    return apiError(error);
  }
}
