import { desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { employees, projects, users } from "@/db/schema";
import { apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

const staffRoles = ["account_manager", "photographer", "content_creator", "production_manager"] as const;

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const rows = await db.select({ user: users, employee: employees }).from(users).leftJoin(employees, eq(users.id, employees.userId)).where(inArray(users.role, [...staffRoles])).orderBy(desc(users.createdAt)).limit(500);
    return NextResponse.json({ team: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const admin = await requireAuth(request, ["admin"]);
    requireActiveAccount(admin);
    const body = await request.json();
    const fullName = requireText(body.fullName, "Team member name", 140);
    const email = requireText(body.email, "Email", 254).toLowerCase();
    const password = requireText(body.password, "Temporary password", 200);
    const role = staffRoles.includes(body.role) ? body.role : null;
    if (!role) return NextResponse.json({ error: "Choose a valid employee role." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 12) return NextResponse.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const [created] = await db.insert(users).values({ fullName, email, passwordHash, role, status: "active", emailVerifiedAt: new Date() }).returning();
    await db.insert(employees).values({ userId: created.id, department: optionalText(body.department, 100), title: optionalText(body.title, 120), phone: optionalText(body.phone, 40) });
    await writeAudit({ actorId: admin.id, action: "employee.created", entityType: "user", entityId: created.id, newValue: { role, email } });
    return NextResponse.json({ member: { ...created, passwordHash: undefined } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    return apiError(error);
  }
}
