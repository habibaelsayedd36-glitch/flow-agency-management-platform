import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { hashPassword, hashToken, revokeAllSessions } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const token = requireText(body.token, "Reset token", 200);
    const password = requireText(body.password, "New password", 200);
    if (password.length < 12) return NextResponse.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
    const [reset] = await db.select().from(passwordResetTokens).where(and(
      eq(passwordResetTokens.tokenHash, hashToken(token)),
      gt(passwordResetTokens.expiresAt, new Date()),
      isNull(passwordResetTokens.consumedAt),
    )).limit(1);
    if (!reset) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });

    const passwordHash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, reset.userId));
      await tx.update(passwordResetTokens).set({ consumedAt: new Date() }).where(eq(passwordResetTokens.id, reset.id));
    });
    await revokeAllSessions(reset.userId);
    await writeAudit({ actorId: reset.userId, action: "auth.password_reset", entityType: "user", entityId: reset.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
