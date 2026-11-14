import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { approvals, products } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client"]);
    requireActiveAccount(user);
    const { id } = await context.params;
    const body = await request.json();
    const status = body.status;
    if (!["approved", "revision_requested", "rejected"].includes(status)) return NextResponse.json({ error: "Choose approve, request a revision, or reject this item." }, { status: 400 });
    const [approval] = await db.select().from(approvals).where(and(eq(approvals.id, id), eq(approvals.organizationId, user.organizationId ?? ""))).limit(1);
    if (!approval) return NextResponse.json({ error: "Approval not found." }, { status: 404 });
    if (approval.status !== "pending") return NextResponse.json({ error: "This approval has already been answered." }, { status: 409 });
    const note = optionalText(body.note, 3000);
    if (status === "revision_requested" && !note) return NextResponse.json({ error: "Please describe the revision you need." }, { status: 400 });
    const [updated] = await db.update(approvals).set({ status, clientNote: note, respondedBy: user.id, respondedAt: new Date() }).where(eq(approvals.id, id)).returning();
    if (approval.productId) {
      const productStatus = status === "approved" ? "approved" : "revision_requested";
      await db.update(products).set({ status: productStatus, updatedAt: new Date() }).where(eq(products.id, approval.productId));
    }
    const [product] = approval.productId ? await db.select({ name: products.name }).from(products).where(eq(products.id, approval.productId)).limit(1) : [];
    const displayAction = status === "approved" ? "approved" : status === "revision_requested" ? "requested a revision for" : "rejected";
    await writeActivity({ actorId: user.id, organizationId: approval.organizationId, entityType: "approval", entityId: id, action: `approval.${status}`, description: `You ${displayAction} “${approval.title}”.${note ? ` ${note}` : ""}`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId: approval.organizationId, action: `approval.${status}`, entityType: "approval", entityId: id, previousValue: { status: approval.status }, newValue: { status, note, product: product?.name } });
    return NextResponse.json({ approval: updated });
  } catch (error) {
    return apiError(error);
  }
}
