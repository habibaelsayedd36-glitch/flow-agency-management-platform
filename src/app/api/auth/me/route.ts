import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    const [organization] = user.organizationId
      ? await db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1)
      : [];
    return NextResponse.json({ user, organization: organization ?? null });
  } catch (error) {
    return apiError(error);
  }
}
