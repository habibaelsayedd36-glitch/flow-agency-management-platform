import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailVerificationTokens, organizations, projects, users } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { hashPassword, hashToken } from "@/lib/auth";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";
import { safeEmailText, sendFlowEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin"]);
    requireActiveAccount(user);
    const rows = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(500);
    const usersRows = rows.length
      ? await db.select({ id: users.id, organizationId: users.organizationId, fullName: users.fullName, email: users.email, role: users.role, status: users.status, emailVerifiedAt: users.emailVerifiedAt }).from(users)
      : [];
    const clientRows = rows.map((organization) => ({
      organization,
      contacts: usersRows.filter((entry) => entry.organizationId === organization.id),
    }));
    return NextResponse.json({ clients: clientRows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin"]);
    requireActiveAccount(user);
    const body = await request.json();
    const companyName = requireText(body.companyName, "Company name", 180);
    const fullName = requireText(body.fullName, "Contact name", 140);
    const email = requireText(body.email, "Email", 254).toLowerCase();
    const password = requireText(body.password, "Temporary password", 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 12) return NextResponse.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const created = await db.transaction(async (tx) => {
      const [organization] = await tx.insert(organizations).values({
        companyName,
        contactPerson: fullName,
        phone: optionalText(body.phone, 40),
        category: optionalText(body.category, 120),
        website: optionalText(body.website, 300),
        description: optionalText(body.description, 3000),
        preferredLanguage: body.preferredLanguage === "ar" ? "ar" : "en",
        status: "pending",
      }).returning();
      const [client] = await tx.insert(users).values({
        organizationId: organization.id,
        fullName,
        email,
        passwordHash,
        role: "client",
        status: "pending",
      }).returning({ id: users.id });
      return { organization, userId: client.id };
    });
    const token = randomBytes(32).toString("hex");
    await db.insert(emailVerificationTokens).values({ userId: created.userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const delivery = await sendFlowEmail({
      to: email,
      subject: "Your FLOW portal workspace is ready to verify",
      html: `<p>Hello ${safeEmailText(fullName)},</p><p>Your ${safeEmailText(companyName)} workspace was created by FLOW. Verify your email to continue.</p><p><a href="${origin}/?verify=${encodeURIComponent(token)}">Verify email address</a></p>`,
    });
    await writeAudit({ actorId: user.id, organizationId: created.organization.id, action: "client.created", entityType: "organization", entityId: created.organization.id, newValue: { companyName, email, verificationEmailSent: delivery.delivered } });
    return NextResponse.json({ client: created.organization, verificationEmailSent: delivery.delivered }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    return apiError(error);
  }
}
