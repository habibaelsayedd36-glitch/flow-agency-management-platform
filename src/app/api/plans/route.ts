import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const plans = user.role === "admin"
      ? await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.price))
      : await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isEnabled, true)).orderBy(asc(subscriptionPlans.price));
    return NextResponse.json({ plans });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const body = await request.json();
    const name = requireText(body.name, "Plan name", 120);
    const price = body.price === "" || body.price === null || body.price === undefined ? null : Number(body.price);
    const quota = body.productQuota === "" || body.productQuota === null || body.productQuota === undefined ? null : Number(body.productQuota);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000000)) return NextResponse.json({ error: "Enter a valid plan price." }, { status: 400 });
    if (quota !== null && (!Number.isInteger(quota) || quota < 0 || quota > 1000000)) return NextResponse.json({ error: "Enter a valid product quota." }, { status: 400 });
    const cycle = ["monthly", "annual"].includes(body.billingCycle) ? body.billingCycle : "monthly";
    const services = Array.isArray(body.includedServices) ? [...new Set<string>(body.includedServices.filter((item: unknown): item is string => typeof item === "string"))].slice(0, 20) : [];
    const [plan] = await db.insert(subscriptionPlans).values({
      name,
      description: optionalText(body.description, 3000),
      billingCycle: cycle,
      productQuota: quota,
      includedServices: services,
      overagePrice: body.overagePrice === "" || body.overagePrice === null || body.overagePrice === undefined ? null : Number(body.overagePrice),
      price,
      currency: typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "EGP",
      isCustom: body.isCustom === true,
      isEnabled: body.isEnabled !== false,
    }).returning();
    await writeAudit({ actorId: admin.id, action: "subscription_plan.created", entityType: "subscription_plan", entityId: plan.id, newValue: { name, price, quota, cycle } });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
