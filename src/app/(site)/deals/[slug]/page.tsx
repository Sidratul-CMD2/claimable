import { and, eq } from "drizzle-orm";
import { AlertTriangle, Archive, ChevronRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CountrySelector from "@/components/layout/CountrySelector";
import { EligibilitySection, EvidenceSection, HistorySection, PricingSection, StudentSection } from "@/components/offers/DetailSections";
import OfferCard, { CompanyMark } from "@/components/offers/OfferCard";
import RedeemAction from "@/components/offers/RedeemAction";
import ReportForm from "@/components/offers/ReportForm";
import StatusBadge from "@/components/offers/StatusBadge";
import { countryName } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import { CONDITION_LABEL, COUNTRY_STATUS_LABEL, USER_ELIGIBILITY_LABEL } from "@/lib/labels";
import { site } from "@/lib/site";
import { db } from "@/server/db";
import { companies, offers } from "@/server/db/schema";
import { resolveCountry, suggestedCountry } from "@/server/request-context";
import { recordEvent } from "@/server/services/analytics";
import { publicOfferWhere } from "@/server/services/bundles";
import { getOfferDetail, getRevealableCoupons } from "@/server/services/offer-detail";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [row] = await db
    .select({ benefit: offers.benefit, title: offers.title, summary: offers.summary, status: offers.publicationStatus, availability: offers.availability, isFixture: offers.isFixture, company: companies.name })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .where(and(eq(offers.slug, slug), publicOfferWhere({ includeExpired: true, includeArchived: true })))
    .limit(1);
  if (!row) return { title: "Offer not found", robots: { index: false } };
  const expired = row.availability === "expired";
  return {
    title: `${row.company}: ${row.benefit}${expired ? " (expired)" : ""}`,
    description: (row.summary || row.title).slice(0, 160),
    alternates: { canonical: `/deals/${slug}` },
    robots: { index: row.status !== "archived" && !row.isFixture, follow: true },
  };
}

export default async function OfferPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const country = await resolveCountry(typeof query.country === "string" ? query.country : null);
  const detail = await getOfferDetail(slug, country);
  if (!detail) notFound();

  const { bundle, decision, card } = detail;
  const o = bundle.offer;
  const expired = o.availability === "expired";
  const revealRequested = query.reveal === "1" && decision.redemption.kind === "reveal";
  const revealed = revealRequested ? await getRevealableCoupons(slug) : null;
  const [suggested] = await Promise.all([
    suggestedCountry(),
    recordEvent({ type: "offer_view", offerId: o.id, countryCode: country, path: `/deals/${slug}` }),
    revealed ? recordEvent({ type: "reveal", offerId: o.id, countryCode: country }) : null,
  ]);
  const userLabel = USER_ELIGIBILITY_LABEL[decision.user.status];
  const countryLabel = COUNTRY_STATUS_LABEL[decision.country.status];

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Deals", item: `${site.url}/deals` },
      { "@type": "ListItem", position: 2, name: bundle.company.name, item: `${site.url}/companies/${bundle.company.slug}` },
      { "@type": "ListItem", position: 3, name: o.benefit, item: `${site.url}/deals/${slug}` },
    ],
  };

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-6 md:px-6 md:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/deals" className="hover:text-fg">
              Deals
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
          <li>
            <Link href={`/companies/${bundle.company.slug}`} className="hover:text-fg">
              {bundle.company.name}
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
          <li aria-current="page" className="truncate text-fg">
            {o.benefit}
          </li>
        </ol>
      </nav>

      {detail.isArchived || expired ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-[var(--negative)]/30 bg-[var(--negative-bg)] px-4 py-3 text-sm" role="status">
          {detail.isArchived ? <Archive className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden="true" /> : <Clock className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden="true" />}
          <p>
            <strong className="text-negative">{expired ? "This offer has expired" : "This offer is archived"}</strong>
            {o.endsAt && o.endsAtConfirmed ? ` — it ended on ${formatDate(o.endsAt)}.` : "."} We keep this page for its history.{" "}
            {detail.related.length ? (
              <a href="#related" className="text-link">
                See current alternatives
              </a>
            ) : null}
          </p>
        </div>
      ) : null}
      {query.redirect === "blocked" ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>We stopped the redirect because the destination is not on an approved domain for {bundle.company.name}. The offer is under review.</p>
        </div>
      ) : null}
      {o.isFixture ? (
        <p className="mt-4 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-4 py-2 text-sm text-warning">Development fixture — fictional data, never shown in production.</p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <header className="lg:col-start-1">
          <div className="flex items-center gap-3">
            <CompanyMark name={bundle.company.name} monogram={card.company.monogram} logoUrl={bundle.company.logoUrl} size="lg" />
            <div>
              <Link href={`/companies/${bundle.company.slug}`} className="font-medium hover:underline">
                {bundle.company.name}
              </Link>
              <p className="text-sm text-muted">{[bundle.product?.name, bundle.plan?.name].filter(Boolean).join(" · ") || card.typeLabel}</p>
            </div>
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">{o.benefit}</h1>
          <p className="mt-2 text-lg text-muted">{o.title}</p>
          {o.summary ? <p className="mt-4 max-w-2xl text-fg/90">{o.summary}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge label={card.typeLabel} tone="neutral" />
            <StatusBadge label={card.verification.label} tone={card.verification.tone} title={card.verification.description} />
            <StatusBadge label={card.availability.label} tone={card.availability.tone} />
            {bundle.categories.map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-fg">
                {c.name}
              </Link>
            ))}
          </div>
        </header>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Claim this offer">
          <div className="bento-card grid gap-4 p-5 lg:sticky lg:top-24">
            {card.priceLine ? (
              <div>
                <p className="text-2xl font-semibold">
                  {card.priceLine} {card.priceDetail ? <span className="text-base font-normal text-muted">{card.priceDetail}</span> : null}
                </p>
                {card.renewalLine ? <p className={`text-sm ${card.renewalLine.includes("not disclosed") ? "text-caution" : "text-muted"}`}>{card.renewalLine}</p> : null}
                {card.savingsLine ? <p className="mt-1 text-sm text-positive">{card.savingsLine}</p> : null}
              </div>
            ) : null}

            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">Before you claim</p>
              <ul className="mt-2 grid gap-1.5 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span>{country ? countryName(country) : "Your country"}</span>
                  <StatusBadge label={country ? countryLabel.label.replace(" in your country", "") : "Not selected"} tone={countryLabel.tone} size="xs" />
                </li>
                {card.conditions.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
                {bundle.conditions.slice(0, 3).map((c) => (
                  <li key={c.kind + c.description} className="text-muted">
                    • {c.description || (CONDITION_LABEL[c.kind as keyof typeof CONDITION_LABEL] ?? c.kind)}
                  </li>
                ))}
                {card.endsLine ? <li className="text-muted">• {card.endsLine}</li> : null}
              </ul>
              <div className="mt-3 flex items-center justify-between gap-2">
                <StatusBadge label={userLabel.label} tone={userLabel.tone} />
                <CountrySelector country={country} suggested={suggested} countryLabel={country ? countryName(country) : null} suggestedLabel={suggested ? countryName(suggested) : null} compact />
              </div>
              {o.studentRequired && o.studentVerificationProvider ? (
                <p className="mt-2 text-xs text-muted">Eligibility is verified by {o.studentVerificationProvider} on the merchant&apos;s side.</p>
              ) : null}
            </div>

            <div id="codes">
              <RedeemAction
                slug={o.slug}
                kind={card.redemption.kind}
                label={card.redemption.label}
                secondaryLabel={card.redemption.secondaryLabel}
                isAffiliate={o.isAffiliate}
                unavailableReason={card.redemption.unavailableReason}
                layout="panel"
                initialCoupons={revealed?.coupons}
              />
            </div>
            {o.isAffiliate ? (
              <p className="text-xs text-muted">
                <strong>Affiliate link.</strong> {o.affiliateDisclosure ?? `${site.name} may earn a commission. This never affects verification or ranking.`}
              </p>
            ) : null}
            {o.isSponsored ? <p className="text-xs text-muted">Sponsored placement. Verification and organic ranking are unaffected.</p> : null}
            <p className="text-xs text-subtle">
              {card.verification.date ? `Terms last confirmed ${card.verification.date}. ` : ""}Opens the merchant&apos;s site — their terms apply.
            </p>
          </div>
        </aside>

        <div className="grid gap-6 lg:col-start-1">
          <PricingSection detail={detail} />
          <EligibilitySection detail={detail} />
          <StudentSection detail={detail} />
          {o.termsSummary || o.officialTermsUrl ? (
            <section aria-labelledby="terms" className="bento-card p-5 md:p-6">
              <h2 id="terms" className="font-display text-xl font-semibold">
                Terms summary
              </h2>
              {o.termsSummary ? <p className="mt-3 whitespace-pre-line text-sm text-fg/90">{o.termsSummary}</p> : null}
              {o.officialTermsUrl ? (
                <p className="mt-3 text-sm">
                  <a href={o.officialTermsUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-link">
                    Read the official terms
                  </a>{" "}
                  <span className="text-muted">— our summary is not a substitute.</span>
                </p>
              ) : null}
            </section>
          ) : null}
          <EvidenceSection detail={detail} />
          <HistorySection detail={detail} />
          <ReportForm slug={o.slug} country={country} couponCodes={revealed?.coupons.map((c) => c.code) ?? []} />
        </div>
      </div>

      {detail.related.length ? (
        <section id="related" aria-labelledby="related-heading" className="mt-14">
          <h2 id="related-heading" className="font-display text-2xl font-semibold">
            {expired ? "Current alternatives" : "Related offers"}
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {detail.related.map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
