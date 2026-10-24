import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/lib/enums";
import { SESSION_COOKIE } from "@/lib/site";
import { createSession, deleteSession, hasRole, validateSessionToken, type SessionUser } from "./sessions";

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Current staff user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return validateSessionToken(store.get(SESSION_COOKIE)?.value);
});

/** For admin pages: redirect to login when signed out. */
export async function requirePageUser(roles: UserRole[] = ["admin", "editor"]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!hasRole(user, roles)) redirect("/admin?denied=1");
  return user;
}

/**
 * For server actions and route handlers: every mutation calls this itself, independent of
 * whichever page rendered the form.
 */
export async function requireRole(roles: UserRole[] = ["admin", "editor"]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!hasRole(user, roles)) throw new AuthorizationError();
  return user;
}

export async function startSession(userId: string) {
  const headerStore = await headers();
  const { token, expiresAt } = await createSession(userId, headerStore.get("user-agent"));
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const store = await cookies();
  await deleteSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}
