import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { serviceCatalog } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const { id } = await context.params;
    const [previous] = await db.select().from(serviceCatalog).where(eq(serviceCatalog.id, id)).limit(1);
    if (!previous) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = requireText(body.name, "Service name", 140);
    if (body.description !== undefined) updates.description = requireText(body.description, "Description", 3000);
    if (body.price !== undefined) {
      const amount = body.price === null || body.price === "" ? null : Number(body.price);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 100000000)) return NextResponse.json({ error: "Enter a valid service price." }, { status: 400 });
      updates.price = amount;
    }
    if (body.priceLabel !== undefined) updates.priceLabel = optionalText(body.priceLabel, 80);
    if (body.isEnabled !== undefined) updates.isEnabled = Boolean(body.isEnabled);
    if (body.unitType !== undefined && typeof body.unitType === "string") updates.unitType = body.unitType.slice(0, 40);
    const [service] = await db.update(serviceCatalog).set(updates).where(eq(serviceCatalog.id, id)).returning();
    await writeAudit({ actorId: admin.id, action: "service_catalog.updated", entityType: "service", entityId: id, previousValue: { name: previous.name, price: previous.price }, newValue: { name: service.name, price: service.price } });
    return NextResponse.json({ service });
  } catch (error) {
    return apiError(error);
  }
}
