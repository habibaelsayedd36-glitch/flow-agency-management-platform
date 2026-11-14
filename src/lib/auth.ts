import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { organizations, sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "flow_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type AuthUser = {
  id: string;
  organizationId: string | null;
  fullName: string;
  email: string;
  role: (typeof import("@/db/schema").userRoleEnum.enumValues)[number];
  status: (typeof import("@/db/schema").accountStatusEnum.enumValues)[number];
  organizationStatus: (typeof import("@/db/schema").accountStatusEnum.enumValues)[number] | null;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function scryptAsync(password: string, salt: Buffer, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltHex, hashHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function revokeSession(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function revokeAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;

  const rows = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      status: users.status,
      organizationStatus: organizations.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(organizations, eq(users.organizationId, organizations.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const user = rows[0];
  if (!user || user.status === "disabled" || user.status === "suspended") return null;
  return user;
}

export function sessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value;
}
