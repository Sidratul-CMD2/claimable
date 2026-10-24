/**
 * Interpreting source checks and scheduling them (brief §15, docs/VERIFICATION.md).
 *
 * Invariant: no outcome here can expire an offer. Retrieval failures, missing pages and
 * changed terms produce observations and review items; expiry only comes from a confirmed
 * end date (see lifecycle.ts) or an administrator's decision.
 */
import type { ObservationOutcome, ReviewKind, RiskTier } from "@/lib/enums";
import { normalizeUrlForComparison } from "./url-safety";

/** Consecutive failures before a human review is opened. */
export const FAILURE_ESCALATION_THRESHOLD = 3;

export type FetchResult =
  | { kind: "response"; httpStatus: number; finalUrl: string; contentHash: string | null; text: string | null }
  | { kind: "timeout"; error: string }
  | { kind: "network_error"; error: string }
  | { kind: "robots_disallowed" }
  | { kind: "invalid_url"; error: string };

export interface CheckContext {
  sourceUrl: string;
  previousHash: string | null;
  expectedMarkers: string[];
  /** Failures recorded before this check. */
  consecutiveFailures: number;
}

export interface ReviewRequest {
  kind: ReviewKind;
  priority: 1 | 2 | 3;
  title: string;
  details: string;
}

export interface CheckDecision {
  outcome: ObservationOutcome;
  markersFound: string[];
  markersMissing: string[];
  /** Retrieval succeeded; updates "last successful check". */
  retrieved: boolean;
  /** Increments the consecutive-failure counter. */
  countsAsFailure: boolean;
  /** The job should retry soon with backoff (transient errors only). */
  retry: boolean;
  reviews: ReviewRequest[];
}

export function normalizeForMatching(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function matchMarkers(text: string, markers: string[]): { found: string[]; missing: string[] } {
  const haystack = normalizeForMatching(text);
  const found: string[] = [];
  const missing: string[] = [];
  for (const marker of markers) {
    const needle = normalizeForMatching(marker);
    if (!needle) continue;
    (haystack.includes(needle) ? found : missing).push(marker);
  }
  return { found, missing };
}

export function interpretCheck(result: FetchResult, ctx: CheckContext): CheckDecision {
  const base = { markersFound: [] as string[], markersMissing: [] as string[], reviews: [] as ReviewRequest[] };
  const failuresAfter = ctx.consecutiveFailures + 1;
  const escalate = failuresAfter >= FAILURE_ESCALATION_THRESHOLD;

  if (result.kind === "robots_disallowed") {
    return {
      ...base,
      outcome: "robots_disallowed",
      retrieved: false,
      countsAsFailure: false,
      retry: false,
      reviews: [
        {
          kind: "robots_disallowed",
          priority: 2,
          title: "Source disallows automated retrieval",
          details: `robots.txt disallows fetching ${ctx.sourceUrl}. Use manual verification or an authorized feed; do not bypass.`,
        },
      ],
    };
  }

  if (result.kind === "invalid_url") {
    return {
      ...base,
      outcome: "error",
      retrieved: false,
      countsAsFailure: true,
      retry: false,
      reviews: [{ kind: "repeated_failures", priority: 2, title: "Source URL rejected", details: result.error }],
    };
  }

  if (result.kind === "timeout" || result.kind === "network_error") {
    return {
      ...base,
      outcome: result.kind === "timeout" ? "timeout" : "error",
      retrieved: false,
      countsAsFailure: true,
      retry: true,
      reviews: escalate
        ? [
            {
              kind: "repeated_failures",
              priority: 2,
              title: `Source unreachable ${failuresAfter} times in a row`,
              details: `${ctx.sourceUrl}: ${result.error}. Not marked expired; evidence will go stale if this continues.`,
            },
          ]
        : [],
    };
  }

  const status = result.httpStatus;
  if (status === 404 || status === 410) {
    return {
      ...base,
      outcome: "not_found",
      retrieved: false,
      countsAsFailure: true,
      retry: false,
      reviews: [
        {
          kind: "page_not_found",
          priority: 1,
          title: `Official page returned ${status}`,
          details: `${ctx.sourceUrl} returned HTTP ${status}. The promotion may have ended or moved; confirm before expiring.`,
        },
      ],
    };
  }

  if (status === 401 || status === 403 || status === 429) {
    return {
      ...base,
      outcome: "blocked",
      retrieved: false,
      countsAsFailure: true,
      retry: false,
      reviews: escalate
        ? [
            {
              kind: "blocked_source",
              priority: 2,
              title: `Source refused access (HTTP ${status})`,
              details: `${ctx.sourceUrl} refused automated access ${failuresAfter} times. Access controls must not be bypassed; verify manually.`,
            },
          ]
        : [],
    };
  }

  if (status < 200 || status >= 300) {
    return {
      ...base,
      outcome: "error",
      retrieved: false,
      countsAsFailure: true,
      retry: status >= 500,
      reviews: escalate
        ? [
            {
              kind: "repeated_failures",
              priority: 2,
              title: `Source returned HTTP ${status} ${failuresAfter} times`,
              details: `${ctx.sourceUrl} keeps failing. Not marked expired.`,
            },
          ]
        : [],
    };
  }

  // 2xx
  const { found, missing } = result.text != null ? matchMarkers(result.text, ctx.expectedMarkers) : { found: [], missing: ctx.expectedMarkers };
  const reviews: ReviewRequest[] = [];
  const redirected = normalizeUrlForComparison(result.finalUrl) !== normalizeUrlForComparison(ctx.sourceUrl);
  if (redirected) {
    reviews.push({
      kind: "redirect_changed",
      priority: 2,
      title: "Official page now redirects elsewhere",
      details: `${ctx.sourceUrl} → ${result.finalUrl}. Check whether the redemption link or terms changed.`,
    });
  }
  if (missing.length) {
    reviews.push({
      kind: "markers_missing",
      priority: missing.length === ctx.expectedMarkers.length ? 1 : 2,
      title: "Expected offer terms not found on the page",
      details: `Missing: ${missing.map((m) => `"${m}"`).join(", ")}. The offer may have changed or ended; review before changing status.`,
    });
  }
  const changed = ctx.previousHash != null && result.contentHash != null && ctx.previousHash !== result.contentHash;
  const outcome: ObservationOutcome = missing.length ? "markers_missing" : redirected ? "redirected" : changed ? "changed" : "ok";

  return { outcome, markersFound: found, markersMissing: missing, retrieved: true, countsAsFailure: false, retry: false, reviews };
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_HOURS: Record<RiskTier, number> = { high: 6, standard: 24, evergreen: 72 };
const DAY_MS = 86_400_000;

export function offerCheckIntervalMinutes(
  offer: { riskTier: RiskTier; monitorIntervalHours: number | null; endsAt: Date | null },
  now: Date = new Date(),
): number {
  if (offer.monitorIntervalHours && offer.monitorIntervalHours > 0) return offer.monitorIntervalHours * 60;
  if (offer.endsAt && offer.endsAt.getTime() > now.getTime() && offer.endsAt.getTime() - now.getTime() < 7 * DAY_MS) {
    return 6 * 60;
  }
  return DEFAULT_INTERVAL_HOURS[offer.riskTier] * 60;
}

/** Retry delay after the n-th consecutive failure (1-based): 5, 20, 80 … capped at 6 hours. */
export function backoffMinutes(attempt: number): number {
  return Math.min(360, 5 * 4 ** Math.max(0, attempt - 1));
}
