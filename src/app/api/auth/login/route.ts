import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { checkRateLimit, clientAddress } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const email = requireText(body.email, "Email", 254).toLowerCase();
    const limit = checkRateLimit(`login:${clientAddress(request)}:${email}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });

    const password = requireText(body.password, "Password", 200);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    if (user.status === "disabled" || user.status === "suspended") {
      return NextResponse.json({ error: "This account is not currently available. Contact your FLOW account manager." }, { status: 403 });
    }

    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true, role: user.role, pendingApproval: user.status === "pending" });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
