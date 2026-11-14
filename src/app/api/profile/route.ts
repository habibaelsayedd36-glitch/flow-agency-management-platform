import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client"]);
    const body = await request.json();
    const organizationId = user.organizationId;
    if (!organizationId) return NextResponse.json({ error: "Client workspace not found." }, { status: 404 });
    const [previous] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!previous) return NextResponse.json({ error: "Client workspace not found." }, { status: 404 });
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ["companyName", "contactPerson"] as const) {
      if (body[field] !== undefined) updates[field] = requireText(body[field], field === "companyName" ? "Company name" : "Contact name", field === "companyName" ? 180 : 140);
    }
    for (const field of ["phone", "category", "website", "description", "additionalRequirements"] as const) {
      if (body[field] !== undefined) updates[field] = optionalText(body[field], field === "description" || field === "additionalRequirements" ? 3000 : 300);
    }
    if (body.preferredLanguage !== undefined) updates.preferredLanguage = body.preferredLanguage === "ar" ? "ar" : "en";
    if (body.monthlyProductEstimate !== undefined) {
      const estimate = body.monthlyProductEstimate === "" || body.monthlyProductEstimate === null ? null : Number(body.monthlyProductEstimate);
      if (estimate !== null && (!Number.isInteger(estimate) || estimate < 0 || estimate > 100000)) return NextResponse.json({ error: "Enter a valid monthly product estimate." }, { status: 400 });
      updates.monthlyProductEstimate = estimate;
    }
    if (Array.isArray(body.targetMarketplaces)) updates.targetMarketplaces = [...new Set<string>(body.targetMarketplaces.filter((value: unknown): value is string => typeof value === "string"))].slice(0, 10);
    if (Array.isArray(body.requiredServices)) updates.requiredServices = [...new Set<string>(body.requiredServices.filter((value: unknown): value is string => typeof value === "string"))].slice(0, 10);
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: "No supported changes were provided." }, { status: 400 });
    const [organization] = await db.update(organizations).set(updates).where(eq(organizations.id, organizationId)).returning();
    if (body.fullName !== undefined) {
      const fullName = requireText(body.fullName, "Contact name", 140);
      await db.update(users).set({ fullName, updatedAt: new Date() }).where(eq(users.id, user.id));
    }
    await writeAudit({ actorId: user.id, organizationId, action: "organization.profile_updated", entityType: "organization", entityId: organizationId, previousValue: { companyName: previous.companyName }, newValue: { companyName: organization.companyName } });
    return NextResponse.json({ organization });
  } catch (error) {
    return apiError(error);
  }
}
