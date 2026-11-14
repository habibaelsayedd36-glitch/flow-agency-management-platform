import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, subscriptions, subscriptionPlans, serviceRequests } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const organizationId = request.nextUrl.searchParams.get("organizationId") || user.organizationId;
    if (user.role === "client" && organizationId !== user.organizationId) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    if (user.role !== "admin" && user.role !== "client" && user.role !== "production_manager") return NextResponse.json({ subscriptions: [] });
    if (organizationId) {
      const rows = await db.select({ subscription: subscriptions, plan: subscriptionPlans }).from(subscriptions).leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id)).where(eq(subscriptions.organizationId, organizationId)).orderBy(desc(subscriptions.createdAt)).limit(1);
      const current = rows[0];
      if (!current) return NextResponse.json({ subscription: null, usage: null });
      const periodStart = current.subscription.startsAt ? new Date(`${current.subscription.startsAt}T00:00:00Z`) : new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
      const [usage] = await db.select({ productsUsed: count() }).from(products).where(and(eq(products.organizationId, organizationId), gte(products.createdAt, periodStart)));
      const quota = current.plan?.productQuota ?? null;
      return NextResponse.json({ subscription: current.subscription, plan: current.plan, usage: { productsUsed: usage?.productsUsed ?? 0, productQuota: quota, remaining: quota === null ? null : Math.max(quota - (usage?.productsUsed ?? 0), 0) } });
    }
    const rows = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(250);
    return NextResponse.json({ subscriptions: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "client"]);
    requireActiveAccount(user);
    const body = await request.json();
    if (user.role === "client") {
      if (body.action !== "request_change") return NextResponse.json({ error: "Clients can request a subscription review; a FLOW administrator applies plan changes." }, { status: 403 });
      const [serviceRequest] = await db.insert(serviceRequests).values({
        organizationId: user.organizationId!,
        projectName: "Subscription plan review",
        productQuantity: 1,
        description: optionalText(body.message, 2000),
        status: "submitted",
        requestedBy: user.id,
      }).returning();
      return NextResponse.json({ request: serviceRequest }, { status: 201 });
    }
    const organizationId = requireText(body.organizationId, "Client workspace", 80);
    const planId = typeof body.planId === "string" && body.planId ? body.planId : null;
    if (planId) {
      const [plan] = await db.select({ id: subscriptionPlans.id, billingCycle: subscriptionPlans.billingCycle }).from(subscriptionPlans).where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.isEnabled, true))).limit(1);
      if (!plan) return NextResponse.json({ error: "Choose an enabled plan." }, { status: 400 });
    }
    const start = new Date();
    const renewal = new Date(start);
    if (body.billingCycle === "annual") renewal.setFullYear(renewal.getFullYear() + 1);
    else renewal.setMonth(renewal.getMonth() + 1);
    const [subscription] = await db.insert(subscriptions).values({
      organizationId,
      planId,
      status: "active",
      billingCycle: body.billingCycle === "annual" ? "annual" : "monthly",
      customPrice: body.customPrice === "" || body.customPrice === null || body.customPrice === undefined ? null : Number(body.customPrice),
      startsAt: start.toISOString().slice(0, 10),
      renewsAt: renewal.toISOString().slice(0, 10),
    }).returning();
    await writeAudit({ actorId: user.id, organizationId, action: "subscription.assigned", entityType: "subscription", entityId: subscription.id, newValue: { planId, billingCycle: subscription.billingCycle } });
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
