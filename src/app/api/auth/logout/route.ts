import { NextRequest, NextResponse } from "next/server";
import { apiError, assertSameOrigin } from "@/lib/api";
import { clearSessionCookie, revokeSession, sessionTokenFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await revokeSession(sessionTokenFromRequest(request));
    return clearSessionCookie(NextResponse.json({ ok: true }));
  } catch (error) {
    return apiError(error);
  }
}
