import { describe, expect, test } from "bun:test";
import { computeCostProjection, computeSavings, isFreeOffer, type PricingInput } from "@/server/domain/pricing";

const now = new Date("2026-10-24T00:00:00Z");
const base: PricingInput = {
  offerType: "direct",
  currency: "USD",
  promoPriceMinor: null,
  promoInterval: null,
  promoDurationMonths: null,
  upfrontPaymentMinor: null,
  renewalPriceMinor: null,
  renewalInterval: null,
  autoRenews: "unknown",
  trialDays: null,
  reference: null,
};
const reliableMonthly = { amountMinor: 2000, currency: "USD", interval: "month" as const, observedAt: new Date("2026-10-01"), isReliable: true };

describe("computeCostProjection", () => {
  test("introductory monthly price then renewal", () => {
    const p = computeCostProjection({
      ...base,
      promoPriceMinor: 1000,
      promoInterval: "month",
      promoDurationMonths: 3,
      renewalPriceMinor: 2000,
      renewalInterval: "month",
      autoRenews: "yes",
    });
    expect(p.firstPayment).toEqual({ amountMinor: 1000, currency: "USD" });
    expect(p.first12Months).toEqual({ amountMinor: 3 * 1000 + 9 * 2000, currency: "USD" });
    expect(p.renewal).toEqual({ amountMinor: 2000, currency: "USD", interval: "month" });
  });

  test("unknown renewal price blocks the 12-month total instead of guessing", () => {
    const p = computeCostProjection({ ...base, promoPriceMinor: 1000, promoInterval: "month", promoDurationMonths: 3 });
    expect(p.first12Months).toBeNull();
    expect(p.first12MonthsReason).toBe("Renewal price not disclosed.");
    expect(p.renewal).toBeNull();
    expect(p.renewalReason).toBe("Renewal price not disclosed.");
  });

  test("unknown promotion length blocks the total unless the promo price is permanent", () => {
    expect(computeCostProjection({ ...base, promoPriceMinor: 500, promoInterval: "month" }).first12MonthsReason).toBe(
      "Promotion length not disclosed.",
    );
    const permanent = computeCostProjection({
      ...base,
      promoPriceMinor: 500,
      promoInterval: "month",
      renewalPriceMinor: 500,
      renewalInterval: "month",
    });
    expect(permanent.first12Months).toEqual({ amountMinor: 6000, currency: "USD" });
  });

  test("annual promo billed upfront", () => {
    const p = computeCostProjection({ ...base, promoPriceMinor: 12000, promoInterval: "year", promoDurationMonths: 12, upfrontPaymentMinor: 12000 });
    expect(p.firstPayment?.amountMinor).toBe(12000);
    expect(p.first12Months?.amountMinor).toBe(12000);
  });

  test("free student year with unknown renewal still has a known first-year cost", () => {
    const p = computeCostProjection({ ...base, offerType: "student", promoPriceMinor: 0, promoInterval: "year", promoDurationMonths: 12 });
    expect(p.first12Months?.amountMinor).toBe(0);
    expect(p.renewal).toBeNull();
  });

  test("free trial then monthly price is approximate", () => {
    const p = computeCostProjection({ ...base, offerType: "free_trial", trialDays: 30, renewalPriceMinor: 1000, renewalInterval: "month", autoRenews: "yes" });
    expect(p.firstPayment?.amountMinor).toBe(0);
    expect(p.first12Months?.approximate).toBe(true);
    expect(p.first12Months?.amountMinor).toBeGreaterThan(10_000);
    expect(p.first12Months?.amountMinor).toBeLessThan(12_000);
  });

  test("lifetime purchase has no renewal", () => {
    const p = computeCostProjection({ ...base, offerType: "lifetime", promoPriceMinor: 4900, promoInterval: "one_time" });
    expect(p.first12Months?.amountMinor).toBe(4900);
    expect(p.renewal).toBeNull();
    expect(p.renewalReason).toContain("One-time purchase");
  });

  test("missing currency yields no figures", () => {
    const p = computeCostProjection({ ...base, currency: null, promoPriceMinor: 100, promoInterval: "month" });
    expect(p.firstPayment).toBeNull();
    expect(p.first12Months).toBeNull();
  });
});

describe("computeSavings", () => {
  const promo = { ...base, promoPriceMinor: 1000, promoInterval: "month" as const, promoDurationMonths: 3, renewalPriceMinor: 2000, renewalInterval: "month" as const };

  test("introductory savings against a reliable same-interval reference", () => {
    const d = computeSavings({ ...promo, reference: reliableMonthly }, now);
    expect(d.savings).toEqual({ kind: "introductory", perPeriodMinor: 1000, percent: 50, overPromoPeriodMinor: 3000, currency: "USD", interval: "month" });
  });

  test("recurring when the promo price is also the renewal price", () => {
    const d = computeSavings({ ...promo, renewalPriceMinor: 1000, reference: reliableMonthly }, now);
    expect(d.savings?.kind).toBe("recurring");
    expect(d.savings?.overPromoPeriodMinor).toBe(12_000);
  });

  test.each([
    ["no_reference", { reference: null }],
    ["reference_unreliable", { reference: { ...reliableMonthly, isReliable: false } }],
    ["reference_stale", { reference: { ...reliableMonthly, observedAt: new Date("2026-01-01") } }],
    ["currency_mismatch", { reference: { ...reliableMonthly, currency: "EUR" } }],
    ["interval_mismatch", { reference: { ...reliableMonthly, interval: "year" as const } }],
    ["not_cheaper", { reference: { ...reliableMonthly, amountMinor: 900 } }],
  ])("refuses to compute savings: %s", (reason, override) => {
    expect(computeSavings({ ...promo, ...override } as PricingInput, now)).toEqual({ savings: null, reason: reason as never });
  });
});

describe("isFreeOffer", () => {
  test("zero price or free trial", () => {
    expect(isFreeOffer({ offerType: "student", promoPriceMinor: 0, trialDays: null })).toBe(true);
    expect(isFreeOffer({ offerType: "free_trial", promoPriceMinor: null, trialDays: 7 })).toBe(true);
    expect(isFreeOffer({ offerType: "direct", promoPriceMinor: 100, trialDays: null })).toBe(false);
  });
});
