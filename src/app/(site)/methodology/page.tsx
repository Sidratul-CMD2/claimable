import type { Metadata } from "next";
import StatusBadge from "@/components/offers/StatusBadge";
import { COUNTRY_STATUS_LABEL, VERIFICATION_LABEL } from "@/lib/labels";
import { site } from "@/lib/site";
import { STALE_AFTER_DAYS } from "@/server/domain/verification";

export const metadata: Metadata = {
  title: "How we verify offers",
  description: `How ${site.name} collects, verifies and labels software offers, handles country eligibility, discloses affiliate links and protects your privacy.`,
  alternates: { canonical: "/methodology" },
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 font-display text-2xl font-semibold">
      {children}
    </h2>
  );
}

export default function MethodologyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-8 pt-6 text-fg/90 md:px-6 md:pt-10 [&_p]:mt-3 [&_p]:leading-relaxed [&_li]:mt-1.5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg md:text-4xl">How we verify offers</h1>
      <p className="text-lg text-muted">A smaller set of offers we can stand behind is more useful than a long list of questionable codes. This page explains what our labels mean — and what they don&apos;t.</p>

      <H2 id="statuses">Verification labels</H2>
      <p>Each offer shows one verification label and the date of the evidence behind it. These are separate from whether the offer is active and from whether you are eligible.</p>
      <ul className="mt-4 grid gap-3">
        {(["officially_confirmed", "redemption_tested", "evidence_supported", "unverified", "stale"] as const).map((k) => (
          <li key={k} className="rounded-xl border border-line p-3">
            <StatusBadge label={VERIFICATION_LABEL[k].label} tone={VERIFICATION_LABEL[k].tone} />
            <span className="mt-1.5 block text-sm text-muted">{VERIFICATION_LABEL[k].description}</span>
          </li>
        ))}
      </ul>
      <p>
        Evidence goes stale after {STALE_AFTER_DAYS.high} days for time-sensitive promotions, {STALE_AFTER_DAYS.standard} days for most offers and {STALE_AFTER_DAYS.evergreen} days for long-running
        programmes such as student plans. We never use a &ldquo;verified working&rdquo; badge: a page being online doesn&apos;t prove a code works, and one successful redemption doesn&apos;t prove it works in every
        country or for every account.
      </p>

      <H2 id="eligibility">Country eligibility</H2>
      <p>Choose your country and each offer shows one of these states. Being able to open a promotion page from your country is not evidence that it applies there.</p>
      <ul className="mt-4 grid gap-2">
        {(["confirmed_eligible", "likely_eligible", "unknown", "confirmed_ineligible"] as const).map((k) => (
          <li key={k}>
            <StatusBadge label={COUNTRY_STATUS_LABEL[k].label} tone={COUNTRY_STATUS_LABEL[k].tone} />
          </li>
        ))}
      </ul>
      <p>Offers confirmed as unavailable in your country are hidden by default, and you can show them. Offers with unconfirmed eligibility stay visible, labelled as such.</p>

      <H2 id="pricing">Prices and savings</H2>
      <p>
        We show the promotional price, how long it lasts and the renewal price whenever the official terms disclose them. If something isn&apos;t disclosed we say so instead of guessing. We calculate savings only against an
        official list price for the same plan, currency and billing period, and we separate temporary introductory savings from permanent discounts.
      </p>

      <H2 id="monitoring">How offers are collected and monitored</H2>
      <ul className="list-disc pl-5">
        <li>Our editors research offers on official company pages and record the source and date.</li>
        <li>Automated checks revisit official pages on a schedule. They respect robots.txt and rate limits, and never bypass logins, CAPTCHAs or anti-bot protection.</li>
        <li>If a page fails to load, goes missing or changes, the offer is flagged for review. It is not marked expired because of a failed check. Offers expire automatically only when a confirmed end date passes.</li>
        <li>Expired offers stay available for their history and are labelled clearly.</li>
        <li>Visitor reports and submissions go to a review queue. A single report never changes an offer&apos;s status.</li>
      </ul>

      <H2 id="calendar">Deals calendar</H2>
      <p>
        <strong>Confirmed</strong> events are officially announced. <strong>Historical</strong> events were observed and have a source. <strong>Predicted</strong> windows are estimated from at least two years of recorded
        history and are never presented as confirmed sale dates. We withhold predictions when there isn&apos;t enough history.
      </p>

      <H2 id="affiliate-disclosure">Affiliate links and sponsorship</H2>
      <p>
        Some links may be affiliate links, which can earn {site.name} a commission at no cost to you. Affiliate offers are labelled on the card and the offer page. Sponsored placements are labelled too. Payment never
        affects an offer&apos;s verification label or its position in organic results. {site.name} doesn&apos;t sell software or process payments: Claim and Visit links take you to the merchant, whose terms apply.
      </p>

      <H2 id="students">Student verification</H2>
      <p>Student eligibility is decided by the merchant or its verification provider. We never ask for your university password, student ID or documents, and we never verify eligibility on anyone&apos;s behalf.</p>

      <H2 id="privacy">Privacy</H2>
      <ul className="list-disc pl-5">
        <li>Browsing, searching and revealing codes need no account.</li>
        <li>Your chosen country is stored in a cookie on your device so we can remember it. We never infer it without your choice.</li>
        <li>Analytics are aggregate counts (searches, views, reveals, outbound clicks). We don&apos;t store IP addresses, user agents or cross-site identifiers.</li>
        <li>For abuse prevention, reports and submissions use a short-lived anonymous fingerprint that rotates daily and can&apos;t be traced back to you.</li>
      </ul>
    </article>
  );
}
