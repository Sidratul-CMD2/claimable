import Link from "next/link";
import { requirePageUser } from "@/server/auth/guard";
import { analyticsSummary } from "@/server/services/analytics";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requirePageUser();
  const a = await analyticsSummary(30);
  const t = a.totals;
  const tiles = [
    ["Searches", t.search ?? 0],
    ["Offer views", t.offer_view ?? 0],
    ["Code reveals", t.reveal ?? 0],
    ["Codes copied", t.copy ?? 0],
    ["Outbound claim clicks", t.claim ?? 0],
    ["Reports", t.report ?? 0],
    ["Submissions", t.submission ?? 0],
  ] as const;
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Analytics (last {a.days} days)</h1>
        <p className="text-sm text-muted">
          Aggregate events only — no IP addresses, user agents or visitor identifiers. A claim click is an outbound interaction, <strong>not</strong> a completed purchase.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="bento-card p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="bento-card p-5" aria-labelledby="top-searches">
          <h2 id="top-searches" className="font-display text-lg font-semibold">
            Top searches
          </h2>
          <ol className="mt-3 grid gap-1 text-sm">
            {a.topSearches.map((s) => (
              <li key={s.query} className="flex justify-between">
                <span>{s.query}</span>
                <span className="text-muted">{s.count}</span>
              </li>
            ))}
            {a.topSearches.length === 0 ? <li className="text-muted">No searches yet.</li> : null}
          </ol>
        </section>
        <section className="bento-card p-5" aria-labelledby="zero">
          <h2 id="zero" className="font-display text-lg font-semibold">
            Searches with no results
          </h2>
          <p className="text-xs text-muted">Signals for missing coverage — never a reason to publish unverified offers.</p>
          <ol className="mt-3 grid gap-1 text-sm">
            {a.zeroResults.map((s) => (
              <li key={s.query} className="flex justify-between">
                <span>{s.query}</span>
                <span className="text-muted">{s.count}</span>
              </li>
            ))}
            {a.zeroResults.length === 0 ? <li className="text-muted">None.</li> : null}
          </ol>
        </section>
      </div>
      <section className="bento-card p-5" aria-labelledby="offers-engagement">
        <h2 id="offers-engagement" className="font-display text-lg font-semibold">
          Offer engagement
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr>
                <th className="py-2 font-medium">Offer</th>
                <th className="py-2 font-medium">Views</th>
                <th className="py-2 font-medium">Reveals</th>
                <th className="py-2 font-medium">Copies</th>
                <th className="py-2 font-medium">Claim clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.topOffers.map((o) => (
                <tr key={o.offerId}>
                  <td className="py-2">
                    <Link href={`/deals/${o.slug}`} className="text-link">
                      {o.title}
                    </Link>
                  </td>
                  <td className="py-2">{o.views}</td>
                  <td className="py-2">{o.reveals}</td>
                  <td className="py-2">{o.copies}</td>
                  <td className="py-2">{o.claims}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
