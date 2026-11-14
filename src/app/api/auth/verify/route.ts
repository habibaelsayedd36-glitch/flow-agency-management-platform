import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailVerificationTokens, users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { hashToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const token = requireText(body.token, "Verification token", 200);
    const [verification] = await db.select().from(emailVerificationTokens).where(and(
      eq(emailVerificationTokens.tokenHash, hashToken(token)),
      gt(emailVerificationTokens.expiresAt, new Date()),
      isNull(emailVerificationTokens.consumedAt),
    )).limit(1);
    if (!verification) return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
    await db.transaction(async (tx) => {
      await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, verification.userId));
      await tx.update(emailVerificationTokens).set({ consumedAt: new Date() }).where(eq(emailVerificationTokens.id, verification.id));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
