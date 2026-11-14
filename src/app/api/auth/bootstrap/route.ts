import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const configuredSecret = process.env.FLOW_ADMIN_BOOTSTRAP_TOKEN;
    if (!configuredSecret) return NextResponse.json({ error: "Admin bootstrap is disabled." }, { status: 404 });
    const body = await request.json();
    const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || String(body.bootstrapToken || "");
    const expected = Buffer.from(configuredSecret);
    const provided = Buffer.from(suppliedSecret);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return NextResponse.json({ error: "Invalid bootstrap credentials." }, { status: 403 });
    }
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    if (existing.length) return NextResponse.json({ error: "An administrator already exists." }, { status: 409 });
    const fullName = requireText(body.fullName, "Administrator name", 140);
    const email = requireText(body.email, "Email", 254).toLowerCase();
    const password = requireText(body.password, "Password", 200);
    if (password.length < 12) return NextResponse.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({
      fullName,
      email,
      passwordHash,
      role: "admin",
      status: "active",
      emailVerifiedAt: new Date(),
    }).returning({ id: users.id });
    const token = await createSession(user.id);
    await writeAudit({ actorId: user.id, action: "admin.bootstrap_created", entityType: "user", entityId: user.id });
    return setSessionCookie(NextResponse.json({ ok: true }), token);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return apiError(error);
  }
}
