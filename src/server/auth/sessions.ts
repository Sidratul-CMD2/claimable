/**
 * Session storage independent of Next.js request APIs (testable from bun test).
 * Raw tokens live only in the HttpOnly cookie; the database stores their SHA-256.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { UserRole } from "@/lib/enums";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { getDummyHash, verifyPassword } from "./password";

export const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function validateSessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date()), isNull(users.disabledAt)))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(token: string | undefined | null) {
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function deleteSessionsForUser(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Returns the user when the credentials are valid and the account is enabled. Constant-ish time. */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || user.disabledAt) return null;
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function hasRole(user: SessionUser | null, roles: UserRole[]): user is SessionUser {
  return !!user && roles.includes(user.role);
}
