import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { apiError, assertSameOrigin } from "@/lib/api";
import { requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(40);
    return NextResponse.json({ notifications: rows, unread: rows.filter((row) => !row.readAt).length });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request);
    const body = await request.json();
    if (body.all === true) {
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    } else if (typeof body.id === "string") {
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, body.id), eq(notifications.userId, user.id)));
    } else {
      return NextResponse.json({ error: "Choose a notification to mark as read." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
