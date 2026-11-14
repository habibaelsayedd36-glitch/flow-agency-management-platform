import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailVerificationTokens, organizations, users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { createSession, hashPassword, hashToken, setSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { safeEmailText, sendFlowEmail } from "@/lib/email";
import { checkRateLimit, clientAddress } from "@/lib/rate-limit";

const marketplaces = new Set(["Amazon", "Noon", "TikTok Shop", "Shopify", "InstaShop", "Other"]);
const services = new Set(["product-photography", "bilingual-listing", "photography-listing-bundle", "marketplace-account-management"]);

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const limit = checkRateLimit(`register:${clientAddress(request)}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many account requests. Try again later." }, { status: 429 });

    const body = await request.json();
    const fullName = requireText(body.fullName, "Contact name", 140);
    const companyName = requireText(body.companyName, "Company name", 180);
    const email = requireText(body.email, "Email", 254).toLowerCase();
    const password = requireText(body.password, "Password", 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 12) return NextResponse.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : null;
    const targetMarketplaces: string[] = Array.isArray(body.targetMarketplaces)
      ? [...new Set<string>(body.targetMarketplaces.filter((item: unknown): item is string => typeof item === "string" && marketplaces.has(item)))].slice(0, 6)
      : [];
    const requiredServices: string[] = Array.isArray(body.requiredServices)
      ? [...new Set<string>(body.requiredServices.filter((item: unknown): item is string => typeof item === "string" && services.has(item)))].slice(0, 10)
      : [];
    const monthlyEstimate = body.monthlyProductEstimate === "" || body.monthlyProductEstimate === undefined ? null : Number(body.monthlyProductEstimate);
    if (monthlyEstimate !== null && (!Number.isInteger(monthlyEstimate) || monthlyEstimate < 0 || monthlyEstimate > 100000)) {
      return NextResponse.json({ error: "Monthly product quantity must be a non-negative whole number." }, { status: 400 });
    }
    const preferredLanguage = body.preferredLanguage === "ar" ? "ar" : "en";
    const passwordHash = await hashPassword(password);

    const created = await db.transaction(async (tx) => {
      const [organization] = await tx.insert(organizations).values([{
        companyName,
        contactPerson: fullName,
        phone,
        category: typeof body.category === "string" ? body.category.trim().slice(0, 120) : null,
        website: typeof body.website === "string" ? body.website.trim().slice(0, 300) : null,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 3000) : null,
        preferredLanguage,
        targetMarketplaces,
        requiredServices,
        monthlyProductEstimate: monthlyEstimate,
        additionalRequirements: typeof body.additionalRequirements === "string" ? body.additionalRequirements.trim().slice(0, 3000) : null,
        status: "pending",
      }]).returning({ id: organizations.id });
      const [user] = await tx.insert(users).values({
        organizationId: organization.id,
        fullName,
        email,
        passwordHash,
        role: "client",
        status: "pending",
      }).returning({ id: users.id });
      return { organizationId: organization.id, userId: user.id };
    });

    const token = await createSession(created.userId);
    const response = NextResponse.json({ ok: true, pendingApproval: true, emailVerificationSent: false });
    setSessionCookie(response, token);

    const emailToken = randomBytes(32).toString("hex");
    await db.insert(emailVerificationTokens).values({
      userId: created.userId,
      tokenHash: hashToken(emailToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const verificationUrl = `${origin}/?verify=${encodeURIComponent(emailToken)}`;
    const delivery = await sendFlowEmail({
      to: email,
      subject: "Verify your FLOW portal email",
      html: `<p>Hello ${safeEmailText(fullName)},</p><p>Confirm your email address to continue setting up your FLOW workspace.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
    });
    if (delivery.delivered) response.headers.set("x-flow-verification", "sent");

    await writeAudit({ actorId: created.userId, organizationId: created.organizationId, action: "client.registration_submitted", entityType: "organization", entityId: created.organizationId });
    return response;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return apiError(error);
  }
}
