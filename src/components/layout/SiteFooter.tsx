import Link from "next/link";
import { site } from "@/lib/site";

const GROUPS = [
  {
    title: "Discover",
    links: [
      { href: "/deals", label: "All deals" },
      { href: "/students", label: "Student offers" },
      { href: "/coupons", label: "Coupons" },
      { href: "/free-trials", label: "Free trials & credits" },
      { href: "/lifetime-deals", label: "Lifetime deals" },
      { href: "/calendar", label: "Deals calendar" },
      { href: "/companies", label: "Companies" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/methodology", label: "How we verify offers" },
      { href: "/methodology#affiliate-disclosure", label: "Affiliate & sponsorship disclosure" },
      { href: "/methodology#privacy", label: "Privacy" },
      { href: "/submit", label: "Submit a deal" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <p className="font-display text-xl font-extrabold tracking-tight">{site.name}</p>
          <p className="mt-2 max-w-sm text-sm text-muted">{site.tagline}</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-subtle">
            {site.name} links to merchants; it does not sell software or process payments. Offers, prices and eligibility can change at any time — the merchant&apos;s
            terms always apply. A listed code is never a guarantee that it will work for you.
          </p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <ul className="mt-3 grid gap-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
