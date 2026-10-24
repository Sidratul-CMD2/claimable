import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OfferCard, { CompanyMark } from "@/components/offers/OfferCard";
import { formatDate, formatPrice } from "@/lib/format";
import { OCCASION_LABEL } from "@/lib/labels";
import { resolveCountry } from "@/server/request-context";
import { getCompanyPage } from "@/server/services/companies";
import { monogram } from "@/server/services/offer-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getCompanyPage((await params).slug, null);
  if (!data) return { title: "Company not found" };
  return {
    title: `${data.company.name} deals, student offers and promotion history`,
    description: data.company.description || `Current offers, known pricing and past promotions for ${data.company.name}.`,
    alternates: { canonical: `/companies/${data.company.slug}` },
    robots: { index: !data.company.isFixture },
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const country = await resolveCountry();
  const data = await getCompanyPage(slug, country);
  if (!data) notFound();
  const { company } = data;
  const bestOffer = data.best ? data.current.find((o) => o.id === data.best!.bestId) : null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-6 md:px-6 md:pt-10">
      <header className="flex flex-wrap items-start gap-4">
        <CompanyMark name={company.name} monogram={monogram(company.name)} logoUrl={company.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{company.name}</h1>
          {company.description ? <p className="mt-2 max-w-2xl text-muted">{company.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-link">
              Official website <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            {data.categories.map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-fg">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section aria-labelledby="current-offers" className="mt-10">
        <h2 id="current-offers" className="font-display text-2xl font-semibold">
          Current offers
        </h2>
        {bestOffer ? (
          <p className="mt-2 text-sm text-muted">
            <strong className="text-positive">Lowest 12-month cost for your country:</strong> {bestOffer.benefit} — compared across {data.best!.comparedIds.length} offers for the same plan and currency.
          </p>
        ) : data.current.length > 1 ? (
          <p className="mt-2 text-sm text-muted">These offers aren&apos;t directly comparable (different plans, currencies, eligibility or missing prices), so we list them without picking a winner.</p>
        ) : null}
        {data.current.length ? (
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.current.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line-strong p-6 text-sm text-muted">
            No current offers. The history below shows what {company.name} has offered before.
          </p>
        )}
      </section>

      {data.pricing.some((p) => p.plans.some((pl) => pl.latest.length)) ? (
        <section aria-labelledby="pricing" className="mt-12">
          <h2 id="pricing" className="font-display text-2xl font-semibold">
            Known list prices
          </h2>
          <p className="mt-1 text-sm text-muted">Observed on official pricing pages. Prices change; check the merchant before buying.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.pricing.flatMap(({ product, plans }) =>
              plans
                .filter((pl) => pl.latest.length)
                .map(({ plan, latest }) => (
                  <div key={plan.id} className="bento-card p-4 text-sm">
                    <p className="font-medium">
                      {product.name} · {plan.name}
                    </p>
                    <ul className="mt-1 text-muted">
                      {latest.map((p) => (
                        <li key={p.id}>
                          {formatPrice(p.amountMinor, p.currency, p.interval)}
                          {p.countryCode ? ` (${p.countryCode})` : ""} · observed {formatDate(p.observedAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )),
            )}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="timeline" className="mt-12">
        <h2 id="timeline" className="font-display text-2xl font-semibold">
          Promotion history
        </h2>
        {data.events.length || data.predicted.length ? (
          <ol className="mt-4 grid gap-2">
            {data.predicted.map((p) => (
              <li key={`${p.occasion}-${p.year}`} className="rounded-xl border border-dashed border-[var(--accent)]/60 p-3 text-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-accent">Predicted — not announced</span>
                <p className="mt-0.5">
                  {OCCASION_LABEL[p.occasion]} {p.year}: around {formatDate(p.startsOn)} – {formatDate(p.endsOn)}
                </p>
                <p className="text-xs text-muted">Based on observed promotions in {p.observedYears.join(" and ")}. Not a confirmed sale date.</p>
              </li>
            ))}
            {data.events.map((e) => (
              <li key={e.id} className={`rounded-xl border p-3 text-sm ${e.kind === "confirmed" ? "border-[var(--positive)]/40" : "border-line"}`}>
                <span className={`text-xs font-medium uppercase tracking-wider ${e.kind === "confirmed" ? "text-positive" : "text-muted"}`}>{e.kind === "confirmed" ? "Confirmed" : "Historical"}</span>
                <p className="mt-0.5">
                  {e.title} · {formatDate(e.startsOn)}
                  {e.endsOn ? ` – ${formatDate(e.endsOn)}` : ""}
                  {e.datesApproximate ? " (approximate)" : ""}
                </p>
                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-link">
                  Source
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted">We haven&apos;t recorded past promotions for {company.name} yet.</p>
        )}
        {data.withheld.length ? (
          <p className="mt-3 text-xs text-subtle">
            {data.withheld.map((w) => `${OCCASION_LABEL[w.occasion]}: ${w.reason}`).join(" ")}
          </p>
        ) : null}
      </section>

      {data.past.length ? (
        <section aria-labelledby="past" className="mt-12">
          <h2 id="past" className="font-display text-2xl font-semibold">
            Past offers
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.past.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.alternatives.length ? (
        <section aria-labelledby="alternatives" className="mt-12">
          <h2 id="alternatives" className="font-display text-2xl font-semibold">
            Related companies
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {data.alternatives.map((a) => (
              <li key={a.slug}>
                <Link href={`/companies/${a.slug}`} className="inline-block rounded-full border border-line px-4 py-2 text-sm hover:border-line-strong">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
