import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth/guard";
import { site } from "@/lib/site";
import { logoutAction } from "../auth-actions";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: { default: "Admin", template: `%s · Admin · ${site.name}` }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-raised px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin" className="font-display text-lg font-extrabold tracking-tight">
            {site.name} <span className="text-xs font-normal text-subtle">admin</span>
          </Link>
          <Link href="/" className="text-xs text-link lg:mt-1 lg:block">
            View site
          </Link>
        </div>
        <AdminNav isAdmin={user.role === "admin"} />
        <div className="mt-6 border-t border-line pt-4 text-xs text-muted">
          <p className="truncate">{user.email}</p>
          <p className="capitalize text-subtle">{user.role}</p>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="text-link">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
