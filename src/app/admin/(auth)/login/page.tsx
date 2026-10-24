import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guard";
import { site } from "@/lib/site";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="bento-card w-full max-w-sm p-6">
        <p className="font-display text-2xl font-extrabold tracking-tight">{site.name}</p>
        <h1 className="mt-1 text-sm text-muted">Staff sign in</h1>
        <LoginForm />
        <p className="mt-6 text-xs text-subtle">Staff accounts are created by an administrator. Visitors don&apos;t need an account to browse or reveal codes.</p>
      </div>
    </main>
  );
}
