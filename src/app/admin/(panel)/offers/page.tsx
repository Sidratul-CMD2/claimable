import Link from "next/link";
import StatusBadge from "@/components/offers/StatusBadge";
import { PUBLICATION_STATUSES, type PublicationStatus } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { AVAILABILITY_LABEL, OFFER_TYPE_LABEL, PUBLICATION_LABEL, VERIFICATION_LABEL } from "@/lib/labels";
import { requirePageUser } from "@/server/auth/guard";
import { listAdminOffers } from "@/server/services/admin-offer-read";

export const metadata = { title: "Offers" };

export default async function AdminOffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser();
  const params = await searchParams;
  const status = PUBLICATION_STATUSES.includes(params.status as PublicationStatus) ? (params.status as PublicationStatus) : undefined;
  const rows = await listAdminOffers({ status, q: params.q?.slice(0, 80), freshness: params.freshness, fixtures: params.fixtures === "1" });
  const tab = (s?: string) => `/admin/offers${s ? `?status=${s}` : ""}`;
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Offers</h1>
          <p className="text-sm text-muted">{rows.length} shown{params.fixtures === "1" ? " (including fixtures)" : ""}</p>
        </div>
        <Link href="/admin/offers/new" className="inline-flex h-10 items-center rounded-full bg-fg px-4 text-sm font-medium text-[var(--ink-on-light)]">
          New offer
        </Link>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
          {[undefined, ...PUBLICATION_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={tab(s)}
              aria-current={status === s ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
            >
              {s ? PUBLICATION_LABEL[s] : "All"}
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex gap-2" action="/admin/offers">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="q">
            Search offers
          </label>
          <input id="q" name="q" defaultValue={params.q} placeholder="Search title or company" className="h-9 rounded-full border border-line bg-surface-2 px-3 text-sm" />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" name="fixtures" value="1" defaultChecked={params.fixtures === "1"} /> Fixtures
          </label>
          <button className="h-9 rounded-full border border-line px-3 text-sm">Filter</button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-surface text-xs text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Offer</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Publication</th>
              <th className="px-3 py-2 font-medium">Availability</th>
              <th className="px-3 py-2 font-medium">Verification</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ offer, company, verification }) => (
              <tr key={offer.id} className="hover:bg-surface">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/offers/${offer.id}`} className="font-medium text-fg hover:underline">
                    {offer.title}
                  </Link>
                  <span className="block text-xs text-muted">
                    {company}
                    {offer.isFixture ? " · fixture" : ""}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted">{OFFER_TYPE_LABEL[offer.offerType]}</td>
                <td className="px-3 py-2.5">{PUBLICATION_LABEL[offer.publicationStatus]}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge label={AVAILABILITY_LABEL[offer.availability].label} tone={AVAILABILITY_LABEL[offer.availability].tone} size="xs" />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge label={VERIFICATION_LABEL[verification].label} tone={VERIFICATION_LABEL[verification].tone} size="xs" />
                </td>
                <td className="px-3 py-2.5 text-muted">{formatDate(offer.updatedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No offers match. <Link href="/admin/offers/new" className="text-link">Create one</Link>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
