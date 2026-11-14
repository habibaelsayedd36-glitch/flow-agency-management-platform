import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const rows = await db.select({ audit: auditLogs, actorName: users.fullName, actorEmail: users.email }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(500);
    return NextResponse.json({ auditLogs: rows });
  } catch (error) {
    return apiError(error);
  }
}
