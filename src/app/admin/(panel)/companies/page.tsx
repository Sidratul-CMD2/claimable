import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { saveCompanyAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import CompanyFields from "@/components/admin/CompanyFields";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { categories, companies, offers } from "@/server/db/schema";

export const metadata = { title: "Companies" };

export default async function AdminCompaniesPage() {
  await requirePageUser();
  const [rows, cats] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name, slug: companies.slug, isFixture: companies.isFixture, domains: companies.allowedDomains, offerCount: sql<number>`count(${offers.id})::int` })
      .from(companies)
      .leftJoin(offers, eq(offers.companyId, companies.id))
      .groupBy(companies.id)
      .orderBy(asc(companies.name)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Companies & plans</h1>
        <p className="text-sm text-muted">Companies own products; products own plans; plans hold list-price observations used for savings maths.</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Approved domains</th>
                <th className="px-3 py-2 font-medium">Offers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/companies/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {c.isFixture ? <span className="ml-2 text-xs text-warning">fixture</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{c.domains.join(", ")}</td>
                  <td className="px-3 py-2.5">{c.offerCount}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-muted">
                    No companies yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <section className="bento-card p-5" aria-labelledby="new-company">
          <h2 id="new-company" className="font-display text-lg font-semibold">
            Add a company
          </h2>
          <ActionForm action={saveCompanyAction} submitLabel="Create company" className="mt-4">
            <CompanyFields categories={cats} />
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
