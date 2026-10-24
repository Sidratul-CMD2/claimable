import { ExternalLink } from "lucide-react";
import type { CountryStatus } from "@/lib/enums";
import { countryName } from "@/lib/countries";
import { formatDate, formatDateTime, formatMoneyWithCode, formatPrice, INTERVAL_ADJECTIVE, pluralize } from "@/lib/format";
import {
  CONDITION_LABEL,
  COUNTRY_STATUS_LABEL,
  CUSTOMER_LABEL,
  RULE_STATUS_LABEL,
  SOURCE_TYPE_LABEL,
  TRI_STATE_LABEL,
  USER_ELIGIBILITY_LABEL,
  VERIFICATION_LABEL,
  VERIFICATION_METHOD_LABEL,
} from "@/lib/labels";
import { RENEWAL_UNKNOWN } from "@/server/domain/pricing";
import type { OfferDetail } from "@/server/services/offer-detail";
import StatusBadge from "./StatusBadge";

const NOT_DISCLOSED = <span className="text-caution">Not disclosed</span>;

function Section({ id, title, children, description }: { id: string; title: string; children: React.ReactNode; description?: string }) {
  return (
    <section aria-labelledby={id} className="bento-card p-5 md:p-6">
      <h2 id={id} className="font-display text-xl font-semibold">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="text-sm text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PricingSection({ detail }: { detail: OfferDetail }) {
  const o = detail.bundle.offer;
  const { projection, savings } = detail.decision;
  const ref = detail.bundle.reference;
  const money = (v: number | null) => (v != null && o.currency ? formatMoneyWithCode(v, o.currency) : NOT_DISCLOSED);
  const rows: [string, React.ReactNode][] = [
    [
      "Normal price",
      ref ? (
        <>
          {formatPrice(ref.amountMinor, ref.currency, ref.interval)}
          <span className="text-muted">
            {" "}
            · observed {formatDate(ref.observedAt)}
            {ref.isReliable ? " on the official pricing page" : " (not verified as the official list price)"}
          </span>
        </>
      ) : (
        NOT_DISCLOSED
      ),
    ],
    ["Promotional price", o.promoPriceMinor != null && o.currency ? formatPrice(o.promoPriceMinor, o.currency, o.promoInterval) : o.trialDays ? `Free for ${pluralize(o.trialDays, "day")}` : NOT_DISCLOSED],
    ["Promotional duration", o.promoDurationMonths != null ? pluralize(o.promoDurationMonths, "month") : o.promoInterval === "one_time" ? "One-time purchase" : NOT_DISCLOSED],
    ["Billing currency", o.currency ?? NOT_DISCLOSED],
    ["Billing frequency", o.promoInterval ? INTERVAL_ADJECTIVE[o.promoInterval] : NOT_DISCLOSED],
    ["Paid upfront", o.upfrontPaymentMinor != null ? money(o.upfrontPaymentMinor) : NOT_DISCLOSED],
    [
      "Renewal price",
      projection.renewal
        ? formatPrice(projection.renewal.amountMinor, projection.renewal.currency, projection.renewal.interval)
        : !projection.renewalReason || projection.renewalReason === RENEWAL_UNKNOWN
          ? NOT_DISCLOSED
          : <span className="text-caution">{projection.renewalReason}</span>,
    ],
    ["Renews automatically", o.autoRenews === "unknown" ? NOT_DISCLOSED : TRI_STATE_LABEL[o.autoRenews]],
    ["Cancellation", o.cancellationTerms ?? NOT_DISCLOSED],
    ["Taxes", o.taxNote ?? NOT_DISCLOSED],
    ["Payment method", o.paymentMethodNote ?? NOT_DISCLOSED],
    ["Applies to existing accounts", o.appliesToExistingAccounts === "unknown" ? NOT_DISCLOSED : TRI_STATE_LABEL[o.appliesToExistingAccounts]],
  ];
  if (o.creditAmountMinor != null) {
    rows.splice(2, 0, [
      "Credit amount",
      <>
        {money(o.creditAmountMinor)}
        {o.creditValidity ? <span className="text-muted"> · {o.creditValidity}</span> : null}
      </>,
    ]);
  }
  if (o.lifetimeTerms) rows.push(["Lifetime terms", o.lifetimeTerms]);
  if (o.advertisedDiscountPercent != null) rows.push(["Advertised discount", `${o.advertisedDiscountPercent}% (as stated by the merchant)`]);

  const fig = (f: typeof projection.firstPayment, reason?: string) =>
    f ? `${f.approximate ? "≈ " : ""}${formatMoneyWithCode(f.amountMinor, f.currency)}` : <span className="text-caution">{reason ?? "Can't calculate"}</span>;

  return (
    <Section id="pricing" title="Pricing and renewal" description="What you pay now and after the promotion. Unknown values are marked rather than guessed.">
      <Rows rows={rows} />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">First payment</p>
          <p className="mt-1 text-lg font-semibold">{fig(projection.firstPayment, projection.firstPaymentReason)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Total over the first 12 months</p>
          <p className="mt-1 text-lg font-semibold">{fig(projection.first12Months, projection.first12MonthsReason)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">After the promotion</p>
          <p className="mt-1 text-lg font-semibold">
            {projection.renewal ? formatPrice(projection.renewal.amountMinor, projection.renewal.currency, projection.renewal.interval) : <span className="text-caution">{projection.renewalReason}</span>}
          </p>
        </div>
      </div>
      {savings.savings ? (
        <p className="mt-4 rounded-xl border border-line px-3 py-2 text-sm">
          <span className="font-medium text-positive">
            Saves {formatMoneyWithCode(savings.savings.perPeriodMinor, savings.savings.currency)} per {savings.savings.interval} ({savings.savings.percent}%)
          </span>{" "}
          versus the official list price for the same plan
          {savings.savings.kind === "introductory"
            ? `, only during the promotion${savings.savings.overPromoPeriodMinor != null ? ` (about ${formatMoneyWithCode(savings.savings.overPromoPeriodMinor, savings.savings.currency)} in total)` : ""}. The renewal price applies afterwards.`
            : `, on every renewal (about ${formatMoneyWithCode(savings.savings.overPromoPeriodMinor ?? 0, savings.savings.currency)} a year).`}
        </p>
      ) : (
        <p className="mt-4 text-xs text-subtle">
          Savings aren&apos;t calculated:{" "}
          {
            {
              no_reference: "we don't have an official list price for this plan.",
              reference_unreliable: "the list price we have isn't confirmed as official.",
              reference_stale: "our list price observation is too old.",
              currency_mismatch: "the list price is in a different currency.",
              interval_mismatch: "the list price uses a different billing period, so the numbers aren't comparable.",
              no_promo_price: "the promotional price isn't disclosed.",
              not_cheaper: "the promotional price isn't lower than the list price we observed.",
            }[savings.reason ?? "no_reference"]
          }
        </p>
      )}
      {projection.first12Months?.approximate ? <p className="mt-2 text-xs text-subtle">≈ approximate: trial length converted to months.</p> : null}
    </Section>
  );
}

export function EligibilitySection({ detail }: { detail: OfferDetail }) {
  const o = detail.bundle.offer;
  const { user, country } = detail.decision;
  const countryLabel = COUNTRY_STATUS_LABEL[country.status];
  const userLabel = USER_ELIGIBILITY_LABEL[user.status];
  return (
    <Section id="eligibility" title="Who can claim it" description="Being able to open the offer page from your country does not mean the offer applies there.">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={userLabel.label} tone={userLabel.tone} />
        <StatusBadge label={detail.decision.countryCode ? `${countryLabel.short} ${countryName(detail.decision.countryCode)}` : countryLabel.label} tone={countryLabel.tone} />
      </div>
      {country.note ? <p className="mt-2 text-sm text-muted">{country.note}</p> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Countries</h3>
          {detail.ruleGroups.length ? (
            <ul className="mt-2 grid gap-2 text-sm">
              {detail.ruleGroups.map((g) => (
                <li key={g.status}>
                  <span className="text-muted">{RULE_STATUS_LABEL[g.status as CountryStatus]}:</span> {g.places.join(", ")}
                </li>
              ))}
              <li className="text-muted">
                Everywhere else: {RULE_STATUS_LABEL[o.defaultCountryStatus].toLowerCase()}
              </li>
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No country restrictions are documented, so country eligibility is not confirmed anywhere.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium">Other conditions</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            <li>{CUSTOMER_LABEL[o.customerEligibility]}</li>
            {o.studentRequired ? <li>Enrolled students only (see requirements below)</li> : null}
            {detail.bundle.conditions.map((c) => (
              <li key={c.kind + c.description}>
                {CONDITION_LABEL[c.kind as keyof typeof CONDITION_LABEL] ?? c.kind}
                {c.description ? <span className="text-muted"> — {c.description}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

export function StudentSection({ detail }: { detail: OfferDetail }) {
  const o = detail.bundle.offer;
  if (!o.studentRequired && o.offerType !== "student") return null;
  const rows: [string, React.ReactNode][] = [
    ["Educational eligibility", o.studentRequirements ?? NOT_DISCLOSED],
    ["Verification provider", o.studentVerificationProvider ?? NOT_DISCLOSED],
    ["Student email required", o.studentEmailRequired === "unknown" ? NOT_DISCLOSED : TRI_STATE_LABEL[o.studentEmailRequired]],
    ["Eligible institutions", o.institutionTypes ?? NOT_DISCLOSED],
    ["Promotional duration", o.promoDurationMonths != null ? pluralize(o.promoDurationMonths, "month") : NOT_DISCLOSED],
    ["Maximum eligible duration", o.maxEligibleDuration ?? NOT_DISCLOSED],
    ["Re-verification", o.verificationRenewal ?? NOT_DISCLOSED],
    ["New or existing customers", CUSTOMER_LABEL[o.customerEligibility]],
  ];
  return (
    <Section id="student" title="Student requirements" description="Eligibility is decided by the merchant or its verification provider, not by us.">
      <Rows rows={rows} />
      <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
        We never ask for your university password, student ID or documents. Verification happens on the merchant&apos;s or provider&apos;s own site.
      </p>
    </Section>
  );
}

export function EvidenceSection({ detail }: { detail: OfferDetail }) {
  const o = detail.bundle.offer;
  const v = detail.decision.verification;
  const label = VERIFICATION_LABEL[v.state];
  const period = detail.observationPeriod;
  return (
    <Section id="evidence" title="Verification and sources">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={label.label} tone={label.tone} />
        {v.state === "stale" ? <span className="text-xs text-muted">(was: {VERIFICATION_LABEL[v.baseState].label.toLowerCase()})</span> : null}
      </div>
      <p className="mt-2 text-sm text-muted">{label.description}</p>
      <Rows
        rows={[
          ["Last confirmed", o.verifiedAt ? `${formatDate(o.verifiedAt)}` : "Never"],
          ["Last checked", o.lastCheckedAt ? formatDateTime(o.lastCheckedAt) : "Not checked automatically yet"],
          ["Freshness window", `Evidence older than ${v.freshnessDays} days is marked stale`],
          [
            "Monitoring record",
            period.checks
              ? `${pluralize(period.checks, "automated check")} since ${formatDate(period.firstObservedAt)}${period.failedChecks ? `, ${period.failedChecks} failed to retrieve the page` : ""}${period.longestGapDays != null && period.longestGapDays > 3 ? `; longest gap ${period.longestGapDays} days` : ""}`
              : "No automated observations yet",
          ],
          ["Known limitations", o.knownLimitations ?? "None recorded"],
        ]}
      />
      {detail.sources.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium">Sources</h3>
          <ul className="mt-2 grid gap-2">
            {detail.sources.map((s) => (
              <li key={s.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-link inline-flex items-center gap-1 break-all">
                  {s.title || s.url}
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <p className="mt-1 text-xs text-muted">
                  {SOURCE_TYPE_LABEL[s.sourceType]}
                  {s.isOfficial ? " · official" : ""} · recorded {formatDate(s.firstDiscoveredAt)}
                  {s.lastSuccessAt ? ` · last retrieved ${formatDate(s.lastSuccessAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.verifications.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium">Verification history</h3>
          <ol className="mt-2 grid gap-2 text-sm">
            {detail.verifications.map((r) => (
              <li key={r.id} className="grid gap-0.5 border-l-2 border-line pl-3">
                <span>
                  <span className="font-medium">{VERIFICATION_LABEL[r.state].label}</span> · {formatDate(r.verifiedAt)}
                  {r.countryCode ? ` · ${countryName(r.countryCode)}` : ""}
                </span>
                <span className="text-xs text-muted">
                  {VERIFICATION_METHOD_LABEL[r.method]}
                  {r.note ? ` — ${r.note}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Section>
  );
}

const CHANGE_LABEL: Record<string, string> = {
  created: "Offer recorded",
  published: "Published",
  archived: "Archived",
  status_changed: "Status changed",
  price_changed: "Pricing changed",
  eligibility_changed: "Eligibility changed",
  redemption_changed: "Redemption link changed",
  dates_changed: "Dates changed",
  coupon_changed: "Coupon codes changed",
  source_added: "Source added",
  source_updated: "Source details updated",
  source_removed: "Source removed",
  verification_recorded: "Verification recorded",
  expired: "Marked expired",
  merged: "Duplicate merged",
  updated: "Details updated",
};

export function HistorySection({ detail }: { detail: OfferDetail }) {
  const promo = detail.priceHistory.filter((p) => p.offerId === detail.bundle.offer.id);
  const firstSeen = detail.revisions.at(-1)?.changedAt ?? detail.bundle.offer.createdAt;
  return (
    <Section id="history" title="History" description={`Tracked by us since ${formatDate(firstSeen)}. We can't show changes from before that, and gaps in monitoring are possible.`}>
      {promo.length ? (
        <div className="mb-5">
          <h3 className="text-sm font-medium">Recorded prices</h3>
          <ul className="mt-2 grid gap-1 text-sm">
            {promo.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {p.kind === "promotional" ? "Promotional" : p.kind === "renewal" ? "Renewal" : "List"}: {formatPrice(p.amountMinor, p.currency, p.interval)}
                </span>
                <span className="text-muted">{formatDate(p.observedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ol className="grid gap-2 text-sm">
        {detail.revisions.map((r) => (
          <li key={r.id} className="grid gap-0.5 border-l-2 border-line pl-3">
            <span>
              <span className="font-medium">{CHANGE_LABEL[r.changeType] ?? r.changeType}</span> · {formatDate(r.changedAt)}
            </span>
            {r.note ? <span className="text-xs text-muted">{r.note}</span> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}
