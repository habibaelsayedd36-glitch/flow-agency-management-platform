import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { isEmailDeliveryConfigured, safeEmailText, sendFlowEmail } from "@/lib/email";
import { checkRateLimit, clientAddress } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const limit = checkRateLimit(`forgot:${clientAddress(request)}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ message: "If an account exists, recovery instructions will be sent when email delivery is configured." });
    const body = await request.json();
    const email = requireText(body.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: "If an account exists, recovery instructions will be sent when email delivery is configured." });
    const [user] = await db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
    if (user && isEmailDeliveryConfigured()) {
      const token = randomBytes(32).toString("hex");
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      });
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const resetUrl = `${origin}/?reset=${encodeURIComponent(token)}`;
      await sendFlowEmail({
        to: user.email,
        subject: "Reset your FLOW portal password",
        html: `<p>Hello ${safeEmailText(user.fullName)},</p><p>Use the secure link below to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    }
    return NextResponse.json({ message: "If an account exists, recovery instructions will be sent when email delivery is configured." });
  } catch (error) {
    return apiError(error);
  }
}
