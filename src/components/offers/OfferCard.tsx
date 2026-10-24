import { CalendarClock, Laptop, RefreshCw, RefreshCwOff, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import type { OfferCardView } from "@/server/services/offer-view";
import type { CardDetails } from "./card-details";
import RedeemAction from "./RedeemAction";
import StatusBadge from "./StatusBadge";

export function CompanyMark({ name, monogram, logoUrl, size = "md" }: { name: string; monogram: string; logoUrl: string | null; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "size-14 text-lg rounded-2xl" : "size-10 text-sm rounded-xl";
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={`${dims} shrink-0 border border-line bg-surface-2 object-contain p-1.5`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${dims} grid shrink-0 place-items-center border border-line bg-[linear-gradient(135deg,rgb(156_67_254/0.18),rgb(76_194_233/0.12))] font-display font-bold text-fg`}
      title={name}
    >
      {monogram}
    </span>
  );
}

const DETAIL_ICONS = { payment: Wallet, updates: RefreshCw, devices: Laptop, renewal: RefreshCwOff } as const;
const DETAIL_LABEL = "text-[11px] font-medium uppercase tracking-wider text-subtle";

/** Optional per-offer details (see card-details.ts); spreads evenly to fill a tall card. */
function CardDetailsBlock({ details }: { details: CardDetails }) {
  return (
    <div className="flex flex-1 flex-col justify-evenly gap-4 border-t border-line pt-4">
      <div>
        <h4 className={DETAIL_LABEL}>What it does</h4>
        <p className="mt-1.5 text-sm text-muted">{details.whatItDoes}</p>
      </div>
      <div>
        <h4 className={DETAIL_LABEL}>What&apos;s included</h4>
        <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {details.included.map((item) => {
            const Icon = DETAIL_ICONS[item.icon];
            return (
              <li key={item.text} className="flex items-center gap-2 text-sm text-muted">
                <Icon className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                {item.text}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h4 className={DETAIL_LABEL}>Good to know</h4>
        <dl className="mt-2 grid divide-y divide-line rounded-xl bg-surface-2 text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {details.facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-3 px-3 py-2 sm:block">
              <dt className="text-xs text-subtle">{fact.label}</dt>
              <dd className="text-right text-fg sm:mt-0.5 sm:text-left">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * Bento-style offer card. Essential details and the redemption action are always visible
 * (no hover-only reveal), and restrictions appear before the action.
 */
export default function OfferCard({
  offer,
  featured = false,
  layout = "grid",
  details,
}: {
  offer: OfferCardView;
  featured?: boolean;
  layout?: "grid" | "list";
  /** Extra content for this specific offer, passed only where a page wants it. */
  details?: CardDetails;
}) {
  const expired = offer.availability.state === "expired";
  const titleId = `offer-${offer.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className={`bento-card flex h-full flex-col gap-4 p-5 ${layout === "list" ? "md:flex-row md:items-stretch md:gap-6" : ""} ${expired ? "opacity-80" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start gap-3">
          <CompanyMark name={offer.company.name} monogram={offer.company.monogram} logoUrl={offer.company.logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{offer.company.name}</p>
            <p className="truncate text-xs text-subtle">{[offer.productName, offer.planName].filter(Boolean).join(" · ") || offer.typeLabel}</p>
          </div>
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">{offer.typeLabel}</span>
        </div>

        <div>
          <h3 id={titleId} className={`font-display font-bold leading-tight tracking-tight text-fg ${featured ? "text-3xl" : "text-2xl"}`}>
            <Link href={`/deals/${offer.slug}`} className="hover:underline hover:decoration-line-strong hover:underline-offset-4">
              {offer.benefit}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted">{offer.title}</p>
          {featured && offer.summary ? <p className="mt-2 line-clamp-3 text-sm text-muted">{offer.summary}</p> : null}
        </div>

        {offer.priceLine || offer.renewalLine ? (
          <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            {offer.priceLine ? (
              <p className="font-semibold text-fg">
                {offer.priceLine}
                {offer.priceDetail ? <span className="font-normal text-muted"> {offer.priceDetail}</span> : null}
              </p>
            ) : null}
            {offer.renewalLine ? (
              <p className={`text-xs ${offer.renewalLine.includes("not disclosed") ? "text-caution" : "text-muted"}`}>{offer.renewalLine}</p>
            ) : null}
            {offer.savingsLine ? <p className="mt-1 text-xs text-positive">{offer.savingsLine}</p> : null}
            {offer.advertisedLine ? <p className="mt-1 text-xs text-muted">{offer.advertisedLine}</p> : null}
          </div>
        ) : null}

        <ul className="flex flex-wrap gap-1.5" aria-label="Eligibility">
          <li>
            <StatusBadge label={offer.country.label} tone={offer.country.tone} title={offer.country.detail} />
          </li>
          {offer.conditions.map((c) => (
            <li key={c}>
              <StatusBadge label={c} tone="accent" />
            </li>
          ))}
        </ul>

        {details ? <CardDetailsBlock details={details} /> : null}
      </div>

      <div className={`flex flex-col gap-3 ${layout === "list" ? "md:w-64 md:shrink-0 md:justify-between" : "mt-auto"}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5" title={offer.verification.description}>
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>
              <span className={`ink-${offer.verification.tone} font-medium`}>{offer.verification.label}</span>
              {offer.verification.date ? ` · ${offer.verification.date}` : ""}
            </span>
          </span>
          {offer.endsLine ? (
            <span className={`inline-flex items-center gap-1.5 ${expired ? "text-negative" : ""}`}>
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {offer.endsLine}
            </span>
          ) : null}
          {expired ? <StatusBadge label="Expired" tone="negative" size="xs" /> : null}
          {offer.isFixture ? <StatusBadge label="Test fixture" tone="warning" size="xs" /> : null}
        </div>
        <div className="grid gap-2">
          <RedeemAction
            slug={offer.slug}
            kind={offer.redemption.kind}
            label={offer.redemption.label}
            secondaryLabel={offer.redemption.secondaryLabel}
            isAffiliate={offer.isAffiliate}
            unavailableReason={offer.redemption.unavailableReason}
          />
          <div className="flex items-center justify-between text-xs">
            <Link href={`/deals/${offer.slug}`} className="text-link">
              Terms, pricing & evidence
            </Link>
            {offer.isAffiliate ? <span className="text-subtle">Affiliate link</span> : null}
            {offer.isSponsored ? <span className="text-subtle">Sponsored</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
