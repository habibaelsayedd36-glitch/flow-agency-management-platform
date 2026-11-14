import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { serviceCatalog, serviceRequests } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, parsePositiveInteger, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";
import { ensureFlowCatalog } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    await ensureFlowCatalog();
    const catalog = await db.select().from(serviceCatalog).where(eq(serviceCatalog.isEnabled, true)).orderBy(serviceCatalog.sortOrder);
    const requests = user.role === "client" && user.organizationId
      ? await db.select().from(serviceRequests).where(eq(serviceRequests.organizationId, user.organizationId)).orderBy(desc(serviceRequests.createdAt)).limit(100)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt)).limit(100)
        : [];
    return NextResponse.json({ catalog, requests });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    await ensureFlowCatalog();
    const body = await request.json();
    const organizationId = user.role === "client" ? user.organizationId : requireText(body.organizationId, "Workspace", 80);
    if (!organizationId) return NextResponse.json({ error: "A client workspace is required." }, { status: 400 });
    await assertOrganizationAccess(user, organizationId);
    const projectName = requireText(body.projectName, "Request name", 180);
    const productQuantity = parsePositiveInteger(body.productQuantity ?? 1, "Product quantity", 100000);
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : null;
    if (serviceId) {
      const [service] = await db.select({ id: serviceCatalog.id }).from(serviceCatalog).where(eq(serviceCatalog.id, serviceId)).limit(1);
      if (!service) return NextResponse.json({ error: "Choose a valid FLOW service." }, { status: 400 });
    }
    const desiredDeadline = typeof body.desiredDeadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.desiredDeadline) ? body.desiredDeadline : null;
    const [requestRow] = await db.insert(serviceRequests).values({
      organizationId,
      serviceId,
      projectName,
      productQuantity,
      description: optionalText(body.description, 4000),
      targetMarketplace: optionalText(body.targetMarketplace, 80),
      desiredDeadline,
      priority: ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal",
      status: "submitted",
      requestedBy: user.id,
    }).returning();
    await writeActivity({ actorId: user.id, organizationId, entityType: "service_request", entityId: requestRow.id, action: "service.requested", description: `Service request “${projectName}” was submitted.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId, action: "service_request.created", entityType: "service_request", entityId: requestRow.id, newValue: { projectName, productQuantity } });
    return NextResponse.json({ request: requestRow }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
