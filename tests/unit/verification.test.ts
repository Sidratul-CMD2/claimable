import { describe, expect, test } from "bun:test";
import {
  automatedCheckRefreshesVerification,
  couponVisibility,
  effectiveVerification,
  STALE_AFTER_DAYS,
} from "@/server/domain/verification";

const now = new Date("2026-10-24T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("effectiveVerification", () => {
  test("fresh evidence keeps its state", () => {
    const d = effectiveVerification({ state: "officially_confirmed", verifiedAt: daysAgo(3), riskTier: "standard" }, now);
    expect(d.state).toBe("officially_confirmed");
    expect(d.staleSince).toBeNull();
  });

  test("evidence older than the risk-tier window becomes stale, keeping the base state", () => {
    const d = effectiveVerification({ state: "redemption_tested", verifiedAt: daysAgo(8), riskTier: "high" }, now);
    expect(d.state).toBe("stale");
    expect(d.baseState).toBe("redemption_tested");
    expect(d.staleSince?.toISOString()).toBe(new Date(daysAgo(8).getTime() + STALE_AFTER_DAYS.high * 86_400_000).toISOString());
  });

  test("evergreen offers tolerate longer gaps", () => {
    expect(effectiveVerification({ state: "officially_confirmed", verifiedAt: daysAgo(60), riskTier: "evergreen" }, now).state).toBe(
      "officially_confirmed",
    );
    expect(effectiveVerification({ state: "officially_confirmed", verifiedAt: daysAgo(91), riskTier: "evergreen" }, now).state).toBe("stale");
  });

  test("a verified state without a timestamp is treated as stale", () => {
    expect(effectiveVerification({ state: "evidence_supported", verifiedAt: null, riskTier: "standard" }, now).state).toBe("stale");
  });

  test("unverified never becomes stale", () => {
    expect(effectiveVerification({ state: "unverified", verifiedAt: null, riskTier: "high" }, now).state).toBe("unverified");
  });
});

describe("automatedCheckRefreshesVerification", () => {
  test("requires an official source with every configured marker present", () => {
    const base = { state: "officially_confirmed" as const, sourceIsOfficial: true, markersConfigured: 2, markersMissing: 0 };
    expect(automatedCheckRefreshesVerification(base)).toBe(true);
    expect(automatedCheckRefreshesVerification({ ...base, markersConfigured: 0 })).toBe(false);
    expect(automatedCheckRefreshesVerification({ ...base, markersMissing: 1 })).toBe(false);
    expect(automatedCheckRefreshesVerification({ ...base, sourceIsOfficial: false })).toBe(false);
  });

  test("never refreshes redemption-tested or weaker states (a live page proves nothing about codes)", () => {
    for (const state of ["redemption_tested", "evidence_supported", "unverified"] as const) {
      expect(automatedCheckRefreshesVerification({ state, sourceIsOfficial: true, markersConfigured: 2, markersMissing: 0 })).toBe(false);
    }
  });
});

describe("couponVisibility", () => {
  test("invalid codes are hidden; unverified codes are revealed with a caveat", () => {
    expect(couponVisibility("invalid").revealable).toBe(false);
    expect(couponVisibility("unverified")).toEqual({ revealable: true, caveat: "unverified" });
    expect(couponVisibility("officially_published")).toEqual({ revealable: true, caveat: "none" });
  });
});
