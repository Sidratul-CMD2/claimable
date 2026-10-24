import type { Metadata } from "next";
import Link from "next/link";
import { CompanyMark } from "@/components/offers/OfferCard";
import { pluralize } from "@/lib/format";
import { monogram } from "@/server/services/offer-view";
import { listCompanies } from "@/server/services/companies";

export const metadata: Metadata = {
  title: "Companies",
  description: "Software companies with tracked offers, student discounts and promotion history.",
  alternates: { canonical: "/companies" },
};

export default async function CompaniesPage() {
  const rows = await listCompanies();
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-6 md:px-6 md:pt-10">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Companies</h1>
      <p className="mt-2 max-w-2xl text-muted">Every company with at least one published offer, current or past. Company pages include known pricing and promotion history.</p>
      {rows.length ? (
        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/companies/${c.slug}`} className="bento-card flex h-full gap-3 p-4">
                <CompanyMark name={c.name} monogram={monogram(c.name)} logoUrl={null} />
                <span className="min-w-0">
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-xs text-muted">{c.active ? pluralize(c.active, "current offer") : "No current offers — see history"}</span>
                  <span className="mt-1 block truncate text-xs text-subtle">{c.categories.map((cat) => cat.name).join(" · ")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">No companies have published offers yet.</p>
      )}
    </div>
  );
}
