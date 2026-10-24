"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, getCurrentUser, startSession } from "@/server/auth/guard";
import { authenticate } from "@/server/auth/sessions";
import { db } from "@/server/db";
import { anonymousFingerprint, clientIp, consumeRateLimit } from "@/server/security/rate-limit";
import { writeAudit } from "@/server/services/audit";

export type LoginState = { error: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };

  const h = await headers();
  const fp = anonymousFingerprint(clientIp(h), h.get("user-agent"));
  const [byClient, byAccount] = await Promise.all([consumeRateLimit(`login:${fp}`, 10, 900), consumeRateLimit(`login-account:${email}`, 5, 900)]);
  if (!byClient.allowed || !byAccount.allowed) {
    return { error: `Too many sign-in attempts. Try again in ${Math.ceil(Math.max(byClient.retryAfterSeconds, byAccount.retryAfterSeconds) / 60)} minutes.` };
  }

  const user = await authenticate(email, password);
  if (!user) return { error: "Incorrect email or password." };
  await startSession(user.id);
  await writeAudit(db, { id: user.id, email: user.email }, "auth.login", "user", user.id);
  redirect("/admin");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await endSession();
  if (user) await writeAudit(db, { id: user.id, email: user.email }, "auth.logout", "user", user.id);
  redirect("/admin/login");
}
