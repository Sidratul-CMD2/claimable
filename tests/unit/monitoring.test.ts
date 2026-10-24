import { describe, expect, test } from "bun:test";
import { expiryDecision, publishProblems, shouldArchive, canTransition } from "@/server/domain/lifecycle";
import { backoffMinutes, interpretCheck, matchMarkers, offerCheckIntervalMinutes, type CheckContext } from "@/server/domain/monitoring";

const ctx: CheckContext = {
  sourceUrl: "https://www.example.com/students",
  previousHash: "aaa",
  expectedMarkers: ["Free for students", "$4.99"],
  consecutiveFailures: 0,
};
const ok = (text: string, overrides: Partial<{ finalUrl: string; contentHash: string; httpStatus: number }> = {}) =>
  ({ kind: "response", httpStatus: 200, finalUrl: ctx.sourceUrl, contentHash: "aaa", text, ...overrides }) as const;

describe("interpretCheck", () => {
  test("all markers present → ok, retrieved", () => {
    const d = interpretCheck(ok("Plans … FREE  for   students … only $4.99/mo"), ctx);
    expect(d).toMatchObject({ outcome: "ok", retrieved: true, countsAsFailure: false, reviews: [] });
  });

  test("content hash change without missing markers → changed, no review", () => {
    const d = interpretCheck(ok("Free for students — $4.99", { contentHash: "bbb" }), ctx);
    expect(d.outcome).toBe("changed");
    expect(d.reviews).toEqual([]);
  });

  test("missing markers → review, never expiry", () => {
    const d = interpretCheck(ok("Plans start at $9.99"), ctx);
    expect(d.outcome).toBe("markers_missing");
    expect(d.markersMissing).toEqual(["Free for students", "$4.99"]);
    expect(d.reviews[0]).toMatchObject({ kind: "markers_missing", priority: 1 });
  });

  test("timeouts retry and only escalate after the threshold", () => {
    const first = interpretCheck({ kind: "timeout", error: "15s" }, ctx);
    expect(first).toMatchObject({ outcome: "timeout", retry: true, countsAsFailure: true, reviews: [] });
    const third = interpretCheck({ kind: "timeout", error: "15s" }, { ...ctx, consecutiveFailures: 2 });
    expect(third.reviews[0].kind).toBe("repeated_failures");
    expect(third.reviews[0].details).toContain("Not marked expired");
  });

  test("5xx retries; 404 opens a high-priority review without retry", () => {
    expect(interpretCheck(ok("", { httpStatus: 503 }), ctx)).toMatchObject({ outcome: "error", retry: true });
    const notFound = interpretCheck(ok("", { httpStatus: 404 }), ctx);
    expect(notFound).toMatchObject({ outcome: "not_found", retry: false, retrieved: false });
    expect(notFound.reviews[0]).toMatchObject({ kind: "page_not_found", priority: 1 });
  });

  test("403/429 are treated as blocked; no bypass, no retry storm", () => {
    const d = interpretCheck(ok("", { httpStatus: 429 }), { ...ctx, consecutiveFailures: 2 });
    expect(d).toMatchObject({ outcome: "blocked", retry: false });
    expect(d.reviews[0].kind).toBe("blocked_source");
  });

  test("robots.txt disallow is not a failure but needs a human decision", () => {
    expect(interpretCheck({ kind: "robots_disallowed" }, ctx)).toMatchObject({
      outcome: "robots_disallowed",
      countsAsFailure: false,
      retry: false,
    });
  });

  test("redirect to another path is flagged", () => {
    const d = interpretCheck(ok("Free for students $4.99", { finalUrl: "https://example.com/pricing" }), ctx);
    expect(d.outcome).toBe("redirected");
    expect(d.reviews[0].kind).toBe("redirect_changed");
  });

  test("marker matching normalises case, whitespace and typographic quotes", () => {
    expect(matchMarkers("It’s  FREE\nfor students", ["it's free for students"]).found).toHaveLength(1);
  });
});

describe("scheduling", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  test("risk tiers and soon-expiring offers", () => {
    expect(offerCheckIntervalMinutes({ riskTier: "evergreen", monitorIntervalHours: null, endsAt: null }, now)).toBe(72 * 60);
    expect(offerCheckIntervalMinutes({ riskTier: "evergreen", monitorIntervalHours: null, endsAt: new Date("2026-10-27") }, now)).toBe(6 * 60);
    expect(offerCheckIntervalMinutes({ riskTier: "standard", monitorIntervalHours: 12, endsAt: null }, now)).toBe(12 * 60);
  });
  test("backoff grows and caps", () => {
    expect([1, 2, 3, 4, 5].map(backoffMinutes)).toEqual([5, 20, 80, 320, 360]);
  });
});

describe("lifecycle", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  test("only confirmed end dates expire automatically", () => {
    expect(expiryDecision({ availability: "active", endsAt: new Date("2026-10-20"), endsAtConfirmed: true }, now)).toBe("expire");
    expect(expiryDecision({ availability: "active", endsAt: new Date("2026-10-20"), endsAtConfirmed: false }, now)).toBe("flag_unconfirmed_end");
    expect(expiryDecision({ availability: "active", endsAt: new Date("2026-11-20"), endsAtConfirmed: true }, now)).toBe("none");
    expect(expiryDecision({ availability: "unknown", endsAt: null, endsAtConfirmed: false }, now)).toBe("none");
  });

  test("archive after the grace period, keeping the record", () => {
    expect(shouldArchive({ availability: "expired", publicationStatus: "published", expiredSince: new Date("2026-09-01") }, now)).toBe(true);
    expect(shouldArchive({ availability: "expired", publicationStatus: "published", expiredSince: new Date("2026-10-10") }, now)).toBe(false);
    expect(shouldArchive({ availability: "active", publicationStatus: "published", expiredSince: null }, now)).toBe(false);
  });

  test("publication requirements", () => {
    const valid = {
      title: "x",
      benefit: "y",
      offerType: "student" as const,
      redemptionUrlApproved: true,
      sourceCount: 1,
      couponCount: 0,
      studentRequired: true,
      studentRequirements: "Enrolled students",
      countryRuleCount: 0,
    };
    expect(publishProblems(valid)).toEqual([]);
    expect(publishProblems({ ...valid, sourceCount: 0, studentRequirements: "" })).toHaveLength(2);
    expect(publishProblems({ ...valid, offerType: "coupon", couponCount: 0 })).toContain("Coupon offers need at least one code.");
  });

  test("transitions", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("published", "pending_review")).toBe(false);
  });
});
