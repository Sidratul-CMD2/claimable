/**
 * Pricing transparency (brief §13).
 *
 * All amounts are integer minor units (cents) in one ISO currency. Nothing here estimates
 * a missing value: if an input needed for a figure is unknown, the figure is `null` and a
 * reason explains what is missing.
 */
import type { BillingInterval, OfferType, TriState } from "@/lib/enums";

/** A list price may anchor savings only if observed this recently. */
export const REFERENCE_MAX_AGE_DAYS = 120;
/** Renewal reason when nothing about renewal is known (other reasons carry real information). */
export const RENEWAL_UNKNOWN = "Renewal price not disclosed.";
const DAY_MS = 86_400_000;

export interface ReferencePrice {
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
  observedAt: Date;
  isReliable: boolean;
  sourceUrl?: string | null;
}

export interface PricingInput {
  offerType: OfferType;
  currency: string | null;
  promoPriceMinor: number | null;
  promoInterval: BillingInterval | null;
  promoDurationMonths: number | null;
  upfrontPaymentMinor: number | null;
  renewalPriceMinor: number | null;
  renewalInterval: BillingInterval | null;
  autoRenews: TriState;
  trialDays: number | null;
  reference: ReferencePrice | null;
}

export type Figure = { amountMinor: number; currency: string; approximate?: boolean } | null;

export interface CostProjection {
  /** Cash paid at signup / in the first billing month. */
  firstPayment: Figure;
  firstPaymentReason?: string;
  /** Total paid over the first 12 months, when the terms allow calculating it. */
  first12Months: Figure;
  first12MonthsReason?: string;
  /** Price per renewal period after the promotion. */
  renewal: { amountMinor: number; currency: string; interval: BillingInterval } | null;
  renewalReason?: string;
}

export interface Savings {
  kind: "introductory" | "recurring";
  /** Saving per billing period versus the reference price. */
  perPeriodMinor: number;
  percent: number;
  /** Saving across the promotional period (capped at 12 months), when known. */
  overPromoPeriodMinor: number | null;
  currency: string;
  interval: BillingInterval;
}

export interface SavingsDecision {
  savings: Savings | null;
  /** Why savings were not calculated, if they were not. */
  reason?:
    | "no_reference"
    | "reference_unreliable"
    | "reference_stale"
    | "currency_mismatch"
    | "interval_mismatch"
    | "no_promo_price"
    | "not_cheaper";
}

const MONTHS_PER_INTERVAL: Record<Exclude<BillingInterval, "one_time">, number> = {
  day: 12 / 365,
  week: 12 / 52,
  month: 1,
  year: 12,
};

function periodsIn12Months(interval: BillingInterval): number | null {
  if (interval === "one_time") return null;
  return 12 / MONTHS_PER_INTERVAL[interval];
}

export function computeCostProjection(p: PricingInput): CostProjection {
  const result: CostProjection = { firstPayment: null, first12Months: null, renewal: null };
  const currency = p.currency;

  // Renewal
  if (p.autoRenews === "no" && p.promoInterval !== "one_time") {
    result.renewalReason = "Does not renew automatically.";
  } else if (p.promoInterval === "one_time" && p.offerType === "lifetime") {
    result.renewalReason = "One-time purchase; no renewal under the stated terms.";
  } else if (p.renewalPriceMinor != null && p.renewalInterval && currency) {
    result.renewal = { amountMinor: p.renewalPriceMinor, currency, interval: p.renewalInterval };
  } else {
    result.renewalReason = RENEWAL_UNKNOWN;
  }

  if (!currency) {
    result.firstPaymentReason = "Currency not disclosed.";
    result.first12MonthsReason = "Currency not disclosed.";
    return result;
  }

  // First payment
  const trialCoversFirstPayment = (p.trialDays ?? 0) > 0;
  if (p.upfrontPaymentMinor != null) {
    result.firstPayment = { amountMinor: p.upfrontPaymentMinor, currency };
  } else if (trialCoversFirstPayment && p.offerType === "free_trial") {
    result.firstPayment = { amountMinor: 0, currency };
  } else if (p.promoPriceMinor != null && p.promoInterval) {
    result.firstPayment = { amountMinor: p.promoPriceMinor, currency };
  } else {
    result.firstPaymentReason = "Promotional price not disclosed.";
  }

  result.first12Months = compute12MonthTotal(p, currency, result);
  return result;
}

function compute12MonthTotal(p: PricingInput, currency: string, projection: CostProjection): Figure {
  const fail = (reason: string): Figure => {
    projection.first12MonthsReason = reason;
    return null;
  };

  // One-time purchases (lifetime deals): the total is the purchase price.
  if (p.promoInterval === "one_time") {
    if (p.promoPriceMinor == null) return fail("Purchase price not disclosed.");
    return { amountMinor: p.promoPriceMinor, currency };
  }

  // Free trials: trial period, then the renewal price.
  if (p.offerType === "free_trial" && p.trialDays && p.promoPriceMinor == null) {
    if (p.autoRenews === "no") return { amountMinor: 0, currency, approximate: false };
    if (p.renewalPriceMinor == null || !p.renewalInterval) return fail("Price after the trial not disclosed.");
    if (p.renewalInterval === "one_time") return fail("Billing after the trial is not recurring.");
    const paidMonths = Math.max(0, 12 - p.trialDays / (365 / 12));
    const perMonth = p.renewalPriceMinor / MONTHS_PER_INTERVAL[p.renewalInterval];
    return { amountMinor: Math.round(perMonth * paidMonths), currency, approximate: true };
  }

  if (p.promoPriceMinor == null || !p.promoInterval) return fail("Promotional price not disclosed.");
  const promoMonthsPerPeriod = MONTHS_PER_INTERVAL[p.promoInterval];

  // Promotion length unknown: only computable if the promotion is the permanent price.
  const promoMonths = p.promoDurationMonths;
  if (promoMonths == null) {
    const renewsAtPromoPrice =
      p.renewalPriceMinor != null && p.renewalPriceMinor === p.promoPriceMinor && p.renewalInterval === p.promoInterval;
    if (!renewsAtPromoPrice) return fail("Promotion length not disclosed.");
    return { amountMinor: Math.round((p.promoPriceMinor / promoMonthsPerPeriod) * 12), currency };
  }

  const coveredMonths = Math.min(12, promoMonths);
  const promoTotal = (p.promoPriceMinor / promoMonthsPerPeriod) * coveredMonths;
  const remainingMonths = 12 - coveredMonths;
  if (remainingMonths <= 0) return { amountMinor: Math.round(promoTotal), currency };

  if (p.autoRenews === "no") return { amountMinor: Math.round(promoTotal), currency };
  if (p.renewalPriceMinor == null || !p.renewalInterval) return fail("Renewal price not disclosed.");
  if (p.renewalInterval === "one_time") return fail("Renewal is not a recurring price.");
  const renewalTotal = (p.renewalPriceMinor / MONTHS_PER_INTERVAL[p.renewalInterval]) * remainingMonths;
  // If renewal is billed annually, the first renewal charge lands inside the 12-month window in full.
  if (p.renewalInterval === "year") {
    return { amountMinor: Math.round(promoTotal + p.renewalPriceMinor), currency };
  }
  return { amountMinor: Math.round(promoTotal + renewalTotal), currency };
}

/**
 * Savings are only calculated against a reliable, recent list price for the same plan,
 * in the same currency and the same billing interval (brief §13, CLAUDE.md pricing rules).
 */
export function computeSavings(p: PricingInput, now: Date = new Date()): SavingsDecision {
  const ref = p.reference;
  if (!ref) return { savings: null, reason: "no_reference" };
  if (!ref.isReliable) return { savings: null, reason: "reference_unreliable" };
  if (now.getTime() - ref.observedAt.getTime() > REFERENCE_MAX_AGE_DAYS * DAY_MS) {
    return { savings: null, reason: "reference_stale" };
  }
  if (p.promoPriceMinor == null || !p.promoInterval || !p.currency) return { savings: null, reason: "no_promo_price" };
  if (ref.currency.toUpperCase() !== p.currency.toUpperCase()) return { savings: null, reason: "currency_mismatch" };
  if (ref.interval !== p.promoInterval || ref.interval === "one_time") {
    return { savings: null, reason: "interval_mismatch" };
  }
  const perPeriod = ref.amountMinor - p.promoPriceMinor;
  if (perPeriod <= 0) return { savings: null, reason: "not_cheaper" };

  const renewsAtPromoPrice =
    p.renewalPriceMinor != null && p.renewalPriceMinor === p.promoPriceMinor && p.renewalInterval === p.promoInterval;
  const kind: Savings["kind"] = renewsAtPromoPrice ? "recurring" : "introductory";

  let overPromoPeriodMinor: number | null = null;
  const periods12 = periodsIn12Months(ref.interval);
  if (kind === "recurring" && periods12) {
    overPromoPeriodMinor = Math.round(perPeriod * periods12);
  } else if (p.promoDurationMonths != null && periods12) {
    const months = Math.min(12, p.promoDurationMonths);
    const periods = months / MONTHS_PER_INTERVAL[ref.interval as Exclude<BillingInterval, "one_time">];
    overPromoPeriodMinor = Math.round(perPeriod * Math.max(1, Math.floor(periods)));
  }

  return {
    savings: {
      kind,
      perPeriodMinor: perPeriod,
      percent: Math.round((perPeriod / ref.amountMinor) * 100),
      overPromoPeriodMinor,
      currency: p.currency.toUpperCase(),
      interval: ref.interval,
    },
  };
}

/** Promotional price normalised to a monthly equivalent for sorting "lowest price". */
export function monthlyEquivalentMinor(amountMinor: number | null, interval: BillingInterval | null): number | null {
  if (amountMinor == null || !interval || interval === "one_time") return null;
  return amountMinor / MONTHS_PER_INTERVAL[interval];
}

/** Free offers: zero promotional price, free trials, or free student/credit plans. */
export function isFreeOffer(p: Pick<PricingInput, "offerType" | "promoPriceMinor" | "trialDays">): boolean {
  if (p.promoPriceMinor === 0) return true;
  return p.offerType === "free_trial" && (p.trialDays ?? 0) > 0;
}
