/**
 * Verification decisions (brief §16, docs/VERIFICATION.md).
 *
 * The stored state is one of four evidence levels. "Stale" is derived here from the age of
 * the supporting evidence and the offer's risk tier, so it can never be forgotten in the DB.
 */
import type { CouponStatus, RiskTier, VerificationState } from "@/lib/enums";

export type EffectiveVerificationState = VerificationState | "stale";

/** Evidence older than this many days is stale. */
export const STALE_AFTER_DAYS: Record<RiskTier, number> = {
  high: 7,
  standard: 30,
  evergreen: 90,
};

const DAY_MS = 86_400_000;

export interface VerificationInput {
  state: VerificationState;
  verifiedAt: Date | null;
  riskTier: RiskTier;
}

export interface VerificationDecision {
  state: EffectiveVerificationState;
  /** The stored evidence level, kept even when stale so the UI can say what went stale. */
  baseState: VerificationState;
  verifiedAt: Date | null;
  staleSince: Date | null;
  freshnessDays: number;
}

export function effectiveVerification(input: VerificationInput, now: Date = new Date()): VerificationDecision {
  const freshnessDays = STALE_AFTER_DAYS[input.riskTier];
  const base: VerificationDecision = {
    state: input.state,
    baseState: input.state,
    verifiedAt: input.verifiedAt,
    staleSince: null,
    freshnessDays,
  };
  if (input.state === "unverified") return base;
  if (!input.verifiedAt) {
    // A verified state without a timestamp is not trustworthy evidence.
    return { ...base, state: "stale" };
  }
  const staleAt = new Date(input.verifiedAt.getTime() + freshnessDays * DAY_MS);
  if (now.getTime() > staleAt.getTime()) {
    return { ...base, state: "stale", staleSince: staleAt };
  }
  return base;
}

/** Ordering for "Recently verified" and ranking: stronger, fresher evidence first. */
export function verificationStrength(state: EffectiveVerificationState): number {
  switch (state) {
    case "redemption_tested":
      return 4;
    case "officially_confirmed":
      return 3;
    case "evidence_supported":
      return 2;
    case "stale":
      return 1;
    case "unverified":
      return 0;
  }
}

/** Whether a coupon may be revealed publicly, and with what caveat. */
export function couponVisibility(status: CouponStatus): { revealable: boolean; caveat: "none" | "unverified" | "expired" } {
  switch (status) {
    case "officially_published":
    case "redemption_tested":
      return { revealable: true, caveat: "none" };
    case "unverified":
      return { revealable: true, caveat: "unverified" };
    case "expired":
      return { revealable: true, caveat: "expired" };
    case "invalid":
      return { revealable: false, caveat: "expired" };
  }
}

/**
 * Whether an automated page check may refresh `verified_at`. Only an official source whose
 * configured terms markers were all found can keep an "officially confirmed" state fresh.
 * Page reachability alone never counts, and automation never creates "redemption tested".
 */
export function automatedCheckRefreshesVerification(params: {
  state: VerificationState;
  sourceIsOfficial: boolean;
  markersConfigured: number;
  markersMissing: number;
}): boolean {
  return (
    params.state === "officially_confirmed" &&
    params.sourceIsOfficial &&
    params.markersConfigured > 0 &&
    params.markersMissing === 0
  );
}
