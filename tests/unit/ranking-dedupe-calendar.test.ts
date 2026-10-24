import { describe, expect, test } from "bun:test";
import { blackFriday, predictWindows, type DatedEvent } from "@/server/domain/calendar";
import { areEquivalent, dedupeKey, possibleDuplicate, type DedupeInput } from "@/server/domain/dedupe";
import { decideRedemption } from "@/server/domain/redemption";
import { pickBestOffer, rankOffers, type RankableOffer } from "@/server/domain/ranking";
import { isPrivateHost, normalizeUrlForComparison, resolveRedirect } from "@/server/domain/url-safety";

const offer = (id: string, o: Partial<RankableOffer> = {}): RankableOffer => ({
  id,
  textScore: 0,
  countryStatus: "unknown",
  verification: "officially_confirmed",
  verifiedAt: new Date("2026-10-20"),
  publishedAt: new Date("2026-10-01"),
  endsAt: null,
  endsAtConfirmed: false,
  availability: "active",
  computedSavingsPercent: null,
  advertisedDiscountPercent: null,
  monthlyPriceMinor: null,
  oneTimePriceMinor: null,
  currency: "USD",
  isSponsored: false,
  ...o,
});

describe("rankOffers", () => {
  test("relevance prefers confirmed-eligible countries over unknown", () => {
    const ranked = rankOffers([offer("a"), offer("b", { countryStatus: "confirmed_eligible" })], "relevance", { hasQuery: false });
    expect(ranked.map((o) => o.id)).toEqual(["b", "a"]);
  });

  test("sponsorship does not change organic order", () => {
    const list = [offer("a", { countryStatus: "confirmed_eligible" }), offer("b", { isSponsored: true })];
    expect(rankOffers(list, "relevance", { hasQuery: false })[0].id).toBe("a");
  });

  test("expired offers always sort last", () => {
    const ranked = rankOffers([offer("old", { availability: "expired", computedSavingsPercent: 90 }), offer("new")], "highest_discount", {
      hasQuery: false,
    });
    expect(ranked.map((o) => o.id)).toEqual(["new", "old"]);
  });

  test("highest discount: computed savings tier before advertised-only", () => {
    const ranked = rankOffers(
      [offer("adv", { advertisedDiscountPercent: 80 }), offer("calc", { computedSavingsPercent: 30 }), offer("none")],
      "highest_discount",
      { hasQuery: false },
    );
    expect(ranked.map((o) => o.id)).toEqual(["calc", "adv", "none"]);
  });

  test("expiring soon only uses confirmed future end dates", () => {
    const now = new Date("2026-10-24");
    const ranked = rankOffers(
      [
        offer("unconfirmed", { endsAt: new Date("2026-10-25"), endsAtConfirmed: false }),
        offer("later", { endsAt: new Date("2026-11-30"), endsAtConfirmed: true }),
        offer("soon", { endsAt: new Date("2026-10-28"), endsAtConfirmed: true }),
      ],
      "expiring_soon",
      { hasQuery: false, now },
    );
    expect(ranked.map((o) => o.id).slice(0, 2)).toEqual(["soon", "later"]);
  });

  test("lowest price never compares across currencies", () => {
    const ranked = rankOffers(
      [offer("eur", { currency: "EUR", monthlyPriceMinor: 100 }), offer("usd", { currency: "USD", monthlyPriceMinor: 500 }), offer("unknown")],
      "lowest_price",
      { hasQuery: false },
    );
    expect(ranked.map((o) => o.id)).toEqual(["usd", "eur", "unknown"]);
  });
});

describe("pickBestOffer", () => {
  const c = (id: string, cost: number | null, o = {}) => ({
    id,
    planId: "p1",
    currency: "USD",
    countryStatus: "confirmed_eligible" as const,
    availability: "active" as const,
    first12MonthsMinor: cost,
    ...o,
  });
  test("declares a winner only among comparable, eligible offers", () => {
    expect(pickBestOffer([c("a", 5000), c("b", 3000)])).toEqual({ bestId: "b", comparedIds: ["b", "a"] });
  });
  test("neutral when not comparable", () => {
    expect(pickBestOffer([c("a", 5000), c("b", 3000, { planId: "p2" })])).toBeNull();
    expect(pickBestOffer([c("a", 5000), c("b", null)])).toBeNull();
    expect(pickBestOffer([c("a", 5000), c("b", 3000, { countryStatus: "unknown" })])).toBeNull();
  });
});

describe("dedupe", () => {
  const base: DedupeInput = {
    companyId: "c1",
    productId: "p1",
    planId: null,
    offerType: "coupon",
    couponCodes: ["save20"],
    redemptionUrl: "https://www.example.com/pricing?utm_source=x",
    promoPriceMinor: null,
    currency: null,
    promoInterval: null,
    advertisedDiscountPercent: 20,
    trialDays: null,
    creditAmountMinor: null,
    studentRequired: false,
    customerEligibility: "new_customers",
    countryRules: [{ scope: "global", countryCode: null, regionCode: null, status: "confirmed_eligible" }],
    startsAt: null,
    endsAt: new Date("2026-12-01T10:00:00Z"),
  };

  test("same promotion from two sources is equivalent (tracking params, case, www ignored)", () => {
    const other = { ...base, couponCodes: ["SAVE20"], redemptionUrl: "https://example.com/pricing/" };
    expect(areEquivalent(base, other)).toBe(true);
    expect(dedupeKey(base)).toBe(dedupeKey(other));
  });

  test("different eligibility or redemption path keeps offers separate", () => {
    expect(areEquivalent(base, { ...base, customerEligibility: "all" })).toBe(false);
    expect(areEquivalent(base, { ...base, countryRules: [{ scope: "country", countryCode: "US", regionCode: null, status: "confirmed_eligible" }] })).toBe(
      false,
    );
    expect(areEquivalent(base, { ...base, redemptionUrl: "https://example.com/students" })).toBe(false);
    expect(possibleDuplicate(base, { ...base, couponCodes: ["OTHER"] })).toBe(true);
  });
});

describe("url safety", () => {
  test("redirects only to approved https domains", () => {
    expect(resolveRedirect("https://www.figma.com/education", ["figma.com"])).toEqual({ ok: true, url: "https://www.figma.com/education" });
    expect(resolveRedirect("https://figma.com.evil.io/x", ["figma.com"])).toEqual({ ok: false, reason: "domain_not_approved" });
    expect(resolveRedirect("http://figma.com", ["figma.com"])).toEqual({ ok: false, reason: "not_https" });
    expect(resolveRedirect("javascript:alert(1)", ["figma.com"])).toEqual({ ok: false, reason: "invalid_url" });
    expect(resolveRedirect("https://user:pw@figma.com", ["figma.com"])).toEqual({ ok: false, reason: "invalid_url" });
  });
  test("private and metadata hosts are blocked for connectors", () => {
    for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254", "192.168.1.1", "::1", "printer.local"]) {
      expect(isPrivateHost(host)).toBe(true);
    }
    expect(isPrivateHost("www.jetbrains.com")).toBe(false);
  });
  test("normalisation for comparison", () => {
    expect(normalizeUrlForComparison("https://WWW.Example.com/a/?b=2&utm_medium=x&a=1#frag")).toBe("example.com/a?a=1&b=2");
  });
});

describe("redemption labels", () => {
  const base = { availability: "active" as const, studentAction: null, studentVerificationProvider: null, revealableCouponCount: 0 };
  test("coupon → Reveal Code with a merchant link", () => {
    expect(decideRedemption({ ...base, offerType: "coupon", revealableCouponCount: 1 })).toMatchObject({
      kind: "reveal",
      label: "Reveal Code",
      secondaryLabel: "Visit website",
    });
  });
  test("direct → Claim Deal; student label reflects the real action", () => {
    expect(decideRedemption({ ...base, offerType: "direct" }).label).toBe("Claim Deal");
    expect(decideRedemption({ ...base, offerType: "student", studentVerificationProvider: "SheerID" }).label).toBe("Verify student eligibility");
    expect(decideRedemption({ ...base, offerType: "student", studentAction: "view" }).label).toBe("View student discount");
    expect(decideRedemption({ ...base, offerType: "student" }).label).toBe("Claim student offer");
  });
  test("expired offers have no claim action", () => {
    expect(decideRedemption({ ...base, offerType: "direct", availability: "expired" }).kind).toBe("none");
  });
});

describe("calendar predictions", () => {
  const ev = (id: string, startsOn: string, endsOn: string, kind: "historical" | "confirmed" = "historical"): DatedEvent => ({
    id,
    companyId: "c1",
    occasion: "black_friday",
    kind,
    startsOn,
    endsOn,
  });

  test("black friday anchor", () => {
    expect(blackFriday(2025).toISOString().slice(0, 10)).toBe("2025-11-28");
    expect(blackFriday(2026).toISOString().slice(0, 10)).toBe("2026-11-27");
  });

  test("withheld with only one observed year", () => {
    const { predicted, withheld } = predictWindows([ev("a", "2025-11-24", "2025-12-01")], new Date("2026-10-24"));
    expect(predicted).toEqual([]);
    expect(withheld[0].observedYears).toEqual([2025]);
  });

  test("two years of evidence produce a window aligned to the occasion", () => {
    // 2024: BF = Nov 29 → started BF-4, ended BF+3. 2025: BF = Nov 28 → started BF-3, ended BF+4.
    const { predicted } = predictWindows([ev("a", "2024-11-25", "2024-12-02"), ev("b", "2025-11-25", "2025-12-02")], new Date("2026-10-24"));
    expect(predicted).toHaveLength(1);
    expect(predicted[0]).toMatchObject({ year: 2026, startsOn: "2026-11-23", endsOn: "2026-12-01", observedYears: [2024, 2025] });
  });

  test("a confirmed announcement replaces the prediction", () => {
    const { predicted } = predictWindows(
      [ev("a", "2024-11-25", "2024-12-02"), ev("b", "2025-11-25", "2025-12-02"), ev("c", "2026-11-20", "2026-11-30", "confirmed")],
      new Date("2026-10-24"),
    );
    expect(predicted).toEqual([]);
  });
});
