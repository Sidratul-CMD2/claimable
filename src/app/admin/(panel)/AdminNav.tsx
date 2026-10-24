"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/companies", label: "Companies & plans" },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/sources", label: "Sources & jobs", adminOnly: false },
  { href: "/admin/calendar", label: "Calendar events" },
  { href: "/admin/homepage", label: "Homepage sections" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/users", label: "Users", adminOnly: true },
];

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="mt-4 overflow-x-auto lg:overflow-visible">
      <ul className="flex gap-1 lg:grid">
        {LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
          const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
