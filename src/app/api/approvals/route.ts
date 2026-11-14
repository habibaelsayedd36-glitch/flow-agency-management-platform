import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { approvals, products, projects } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { assertOrganizationAccess, assertProductAccess, canManageWork, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const orgIds = user.role === "client" ? (user.organizationId ? [user.organizationId] : []) : user.role === "admin" || user.role === "production_manager" ? null :
      user.role === "account_manager" ? (await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id))).map((row) => row.organizationId) : [];
    const rows = orgIds === null
      ? await db.select({ approval: approvals, productName: products.name }).from(approvals).leftJoin(products, eq(approvals.productId, products.id)).orderBy(desc(approvals.requestedAt)).limit(200)
      : orgIds.length
        ? await db.select({ approval: approvals, productName: products.name }).from(approvals).leftJoin(products, eq(approvals.productId, products.id)).where(inArray(approvals.organizationId, [...new Set(orgIds)])).orderBy(desc(approvals.requestedAt)).limit(200)
        : [];
    const visible = rows.filter((row) => user.role !== "client" || row.approval.organizationId === user.organizationId);
    return NextResponse.json({ approvals: visible });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const body = await request.json();
    const productId = requireText(body.productId, "Product", 80);
    const product = await assertProductAccess(user, productId);
    const title = requireText(body.title, "Approval title", 180);
    const approvalType = ["photography", "content", "listing", "deliverable"].includes(body.approvalType) ? body.approvalType : "deliverable";
    const [approval] = await db.insert(approvals).values({
      organizationId: product.organizationId,
      projectId: product.projectId,
      productId,
      title,
      approvalType,
      status: "pending",
      requestedBy: user.id,
    }).returning();
    await db.update(products).set({ status: "awaiting_client_approval", updatedAt: new Date() }).where(eq(products.id, productId));
    await writeActivity({ actorId: user.id, organizationId: product.organizationId, entityType: "approval", entityId: approval.id, action: "approval.requested", description: `Approval requested for “${product.name}”.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId: product.organizationId, action: "approval.requested", entityType: "approval", entityId: approval.id, newValue: { title, approvalType } });
    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
