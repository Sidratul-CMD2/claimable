/**
 * Assembles domain decisions for an offer and turns them into serialisable view models.
 * Components render these; they never recompute eligibility, verification or pricing.
 */
import type { BillingInterval, OfferType } from "@/lib/enums";
import { countryName, regionsOfCountry } from "@/lib/countries";
import { formatDate, formatMoneyWithCode, formatPrice, INTERVAL_LABEL, pluralize } from "@/lib/format";
import {
  AVAILABILITY_LABEL,
  COUNTRY_STATUS_LABEL,
  OFFER_TYPE_LABEL,
  VERIFICATION_LABEL,
  type Tone,
} from "@/lib/labels";
import {
  evaluateCountryEligibility,
  evaluateUserEligibility,
  isConfirmedWorldwide,
  type CountryEligibility,
  type UserEligibility,
} from "../domain/eligibility";
import {
  computeCostProjection,
  computeSavings,
  isFreeOffer,
  monthlyEquivalentMinor,
  type CostProjection,
  type PricingInput,
  type SavingsDecision,
} from "../domain/pricing";
import { decideRedemption, type RedemptionDecision } from "../domain/redemption";
import type { RankableOffer } from "../domain/ranking";
import { couponVisibility, effectiveVerification, type VerificationDecision } from "../domain/verification";
import type { OfferBundle } from "./bundles";

export interface OfferDecision {
  countryCode: string | null;
  verification: VerificationDecision;
  country: CountryEligibility;
  user: UserEligibility;
  pricingInput: PricingInput;
  projection: CostProjection;
  savings: SavingsDecision;
  redemption: RedemptionDecision;
  revealableCoupons: number;
  worldwide: boolean;
  isFree: boolean;
}

export function decideOffer(bundle: OfferBundle, ctx: { country: string | null; now?: Date }): OfferDecision {
  const now = ctx.now ?? new Date();
  const o = bundle.offer;
  const verification = effectiveVerification({ state: o.verificationState, verifiedAt: o.verifiedAt, riskTier: o.riskTier }, now);
  const country = evaluateCountryEligibility(bundle.rules, o.defaultCountryStatus, ctx.country, regionsOfCountry);
  const user = evaluateUserEligibility({
    country,
    studentRequired: o.studentRequired || o.offerType === "student",
    customerEligibility: o.customerEligibility,
  });
  const pricingInput: PricingInput = {
    offerType: o.offerType,
    currency: o.currency,
    promoPriceMinor: o.promoPriceMinor,
    promoInterval: o.promoInterval,
    promoDurationMonths: o.promoDurationMonths,
    upfrontPaymentMinor: o.upfrontPaymentMinor,
    renewalPriceMinor: o.renewalPriceMinor,
    renewalInterval: o.renewalInterval,
    autoRenews: o.autoRenews,
    trialDays: o.trialDays,
    reference: bundle.reference,
  };
  const revealableCoupons = bundle.coupons.filter((c) => couponVisibility(c.status).revealable && c.status !== "expired").length;
  return {
    countryCode: ctx.country,
    verification,
    country,
    user,
    pricingInput,
    projection: computeCostProjection(pricingInput),
    savings: computeSavings(pricingInput, now),
    redemption: decideRedemption({
      offerType: o.offerType,
      availability: o.availability,
      studentAction: o.studentAction,
      studentVerificationProvider: o.studentVerificationProvider,
      revealableCouponCount: revealableCoupons,
    }),
    revealableCoupons,
    worldwide: isConfirmedWorldwide(bundle.rules),
    isFree: isFreeOffer(pricingInput),
  };
}

export function toRankable(bundle: OfferBundle, d: OfferDecision, textScore = 0): RankableOffer {
  const o = bundle.offer;
  return {
    id: o.id,
    textScore,
    countryStatus: d.country.status,
    verification: d.verification.state,
    verifiedAt: o.verifiedAt,
    publishedAt: o.publishedAt,
    endsAt: o.endsAt,
    endsAtConfirmed: o.endsAtConfirmed,
    availability: o.availability,
    computedSavingsPercent: d.savings.savings?.percent ?? null,
    advertisedDiscountPercent: o.advertisedDiscountPercent,
    monthlyPriceMinor: monthlyEquivalentMinor(o.promoPriceMinor, o.promoInterval),
    oneTimePriceMinor: o.promoInterval === "one_time" ? o.promoPriceMinor : null,
    currency: o.currency,
    isSponsored: o.isSponsored,
  };
}

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

export interface Badge {
  label: string;
  tone: Tone;
}

export interface OfferCardView {
  id: string;
  slug: string;
  title: string;
  benefit: string;
  summary: string;
  offerType: OfferType;
  typeLabel: string;
  company: { slug: string; name: string; monogram: string; logoUrl: string | null };
  productName: string | null;
  planName: string | null;
  priceLine: string | null;
  priceDetail: string | null;
  renewalLine: string | null;
  savingsLine: string | null;
  advertisedLine: string | null;
  country: Badge & { detail: string };
  conditions: string[];
  verification: Badge & { date: string | null; description: string };
  availability: Badge & { state: string };
  endsLine: string | null;
  redemption: { kind: RedemptionDecision["kind"]; label: string; href: string; secondaryLabel: string | null; unavailableReason: string | null };
  isAffiliate: boolean;
  isSponsored: boolean;
  isFixture: boolean;
  lastChecked: string | null;
  studentProvider: string | null;
}

export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

function durationText(months: number | null): string | null {
  if (months == null) return null;
  if (months % 12 === 0) return `for ${pluralize(months / 12, "year")}`;
  return `for ${pluralize(months, "month")}`;
}

export function priceLines(bundle: OfferBundle, d: OfferDecision): { priceLine: string | null; priceDetail: string | null; renewalLine: string | null } {
  const o = bundle.offer;
  let priceLine: string | null = null;
  let priceDetail: string | null = null;

  if (o.promoPriceMinor != null && o.currency) {
    priceLine = o.promoInterval === "one_time" ? `${formatMoneyWithCode(o.promoPriceMinor, o.currency)} one-time` : formatPrice(o.promoPriceMinor, o.currency, o.promoInterval);
    const duration = durationText(o.promoDurationMonths);
    const permanent = o.renewalPriceMinor != null && o.renewalPriceMinor === o.promoPriceMinor && o.renewalInterval === o.promoInterval;
    if (duration) priceDetail = duration;
    // e.g. student plans that last "while you remain a student"
    else if (o.maxEligibleDuration) priceDetail = o.maxEligibleDuration;
    else if (!permanent && o.promoInterval !== "one_time") priceDetail = "promotion length not disclosed";
  } else if (o.trialDays) {
    priceLine = "Free trial";
    priceDetail = `${pluralize(o.trialDays, "day")}`;
  } else if (o.creditAmountMinor != null && o.currency) {
    priceLine = `${formatMoneyWithCode(o.creditAmountMinor, o.currency)} credit`;
    priceDetail = o.creditValidity;
  }

  let renewalLine: string | null = null;
  if (d.projection.renewal) {
    renewalLine = `Then ${formatPrice(d.projection.renewal.amountMinor, d.projection.renewal.currency, d.projection.renewal.interval)}`;
    if (o.renewalPriceMinor === o.promoPriceMinor && o.renewalInterval === o.promoInterval) renewalLine = "Same price on renewal";
  } else if (o.autoRenews === "no") {
    renewalLine = "Does not renew automatically";
  } else if (o.promoInterval === "one_time") {
    renewalLine = "No renewal stated";
  } else if (priceLine) {
    renewalLine = "Renewal price not disclosed";
  }
  return { priceLine, priceDetail, renewalLine };
}

function countryBadge(bundle: OfferBundle, d: OfferDecision): Badge & { detail: string } {
  const status = d.country.status;
  if (status !== "not_selected") {
    const label = COUNTRY_STATUS_LABEL[status];
    const name = countryName(d.countryCode);
    return { label: `${label.short} ${name}`.trim(), tone: label.tone, detail: label.label };
  }
  if (d.worldwide) return { label: "Worldwide (confirmed)", tone: "positive", detail: "Official terms state no country restriction." };
  const confirmed = bundle.rules.filter((r) => r.scope === "country" && r.status === "confirmed_eligible").map((r) => countryName(r.countryCode));
  if (confirmed.length) {
    const text = confirmed.length <= 2 ? confirmed.join(", ") : `${confirmed.length} countries`;
    return { label: `Confirmed: ${text}`, tone: "info", detail: "Select your country to check eligibility." };
  }
  return { label: "Country eligibility not confirmed", tone: "neutral", detail: "Select your country to check eligibility." };
}

function savingsLine(d: OfferDecision): string | null {
  const s = d.savings.savings;
  if (!s) return null;
  const per = INTERVAL_LABEL[s.interval];
  if (s.kind === "recurring") return `Save ${s.percent}% every ${per} vs. list price`;
  return `Save ${s.percent}% while the promotion lasts`;
}

export function conditionLabels(bundle: OfferBundle): string[] {
  const o = bundle.offer;
  const labels: string[] = [];
  if (o.studentRequired || o.offerType === "student") labels.push("Students only");
  if (o.customerEligibility === "new_customers") labels.push("New customers only");
  if (o.customerEligibility === "existing_customers") labels.push("Existing customers only");
  return labels;
}

export function endsLine(o: OfferBundle["offer"], now: Date = new Date()): string | null {
  if (!o.endsAt) return null;
  if (!o.endsAtConfirmed) return "End date not confirmed";
  return o.endsAt.getTime() < now.getTime() ? `Ended ${formatDate(o.endsAt)}` : `Ends ${formatDate(o.endsAt)}`;
}

export function toCardView(bundle: OfferBundle, d: OfferDecision): OfferCardView {
  const o = bundle.offer;
  const v = VERIFICATION_LABEL[d.verification.state];
  const a = AVAILABILITY_LABEL[o.availability];
  const prices = priceLines(bundle, d);
  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    benefit: o.benefit,
    summary: o.summary,
    offerType: o.offerType,
    typeLabel: OFFER_TYPE_LABEL[o.offerType],
    company: { slug: bundle.company.slug, name: bundle.company.name, monogram: monogram(bundle.company.name), logoUrl: bundle.company.logoUrl },
    productName: bundle.product?.name ?? null,
    planName: bundle.plan?.name ?? null,
    ...prices,
    savingsLine: savingsLine(d),
    advertisedLine: o.advertisedDiscountPercent != null && !d.savings.savings ? `Advertised: ${o.advertisedDiscountPercent}% off` : null,
    country: countryBadge(bundle, d),
    conditions: conditionLabels(bundle),
    verification: {
      label: v.label,
      tone: v.tone,
      date: o.verifiedAt ? formatDate(o.verifiedAt) : null,
      description: v.description,
    },
    availability: { label: a.label, tone: a.tone, state: o.availability },
    endsLine: endsLine(o),
    redemption: {
      kind: d.redemption.kind,
      label: d.redemption.label,
      href: `/go/${o.slug}`,
      secondaryLabel: d.redemption.secondaryLabel ?? null,
      unavailableReason: d.redemption.unavailableReason ?? null,
    },
    isAffiliate: o.isAffiliate,
    isSponsored: o.isSponsored,
    isFixture: o.isFixture,
    lastChecked: o.lastCheckedAt ? formatDate(o.lastCheckedAt) : null,
    studentProvider: o.studentVerificationProvider,
  };
}

export function intervalText(interval: BillingInterval | null): string {
  return interval ? INTERVAL_LABEL[interval] : "Not disclosed";
}
