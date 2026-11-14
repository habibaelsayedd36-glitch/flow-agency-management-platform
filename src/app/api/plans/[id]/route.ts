import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const { id } = await context.params;
    const [previous] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    if (!previous) return NextResponse.json({ error: "Subscription plan not found." }, { status: 404 });
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim().slice(0, 120);
    if (body.description !== undefined) updates.description = optionalText(body.description, 3000);
    if (body.price !== undefined) {
      const amount = body.price === null || body.price === "" ? null : Number(body.price);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
      updates.price = amount;
    }
    if (body.productQuota !== undefined) {
      const quota = body.productQuota === null || body.productQuota === "" ? null : Number(body.productQuota);
      if (quota !== null && (!Number.isInteger(quota) || quota < 0)) return NextResponse.json({ error: "Enter a valid quota." }, { status: 400 });
      updates.productQuota = quota;
    }
    if (body.billingCycle !== undefined && ["monthly", "annual"].includes(body.billingCycle)) updates.billingCycle = body.billingCycle;
    if (body.isEnabled !== undefined) updates.isEnabled = Boolean(body.isEnabled);
    if (body.isCustom !== undefined) updates.isCustom = Boolean(body.isCustom);
    if (Array.isArray(body.includedServices)) updates.includedServices = [...new Set<string>(body.includedServices.filter((item: unknown): item is string => typeof item === "string"))];
    const [plan] = await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, id)).returning();
    await writeAudit({ actorId: admin.id, action: "subscription_plan.updated", entityType: "subscription_plan", entityId: id, previousValue: { name: previous.name, price: previous.price }, newValue: { name: plan.name, price: plan.price } });
    return NextResponse.json({ plan });
  } catch (error) {
    return apiError(error);
  }
}
