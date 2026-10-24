/**
 * Which redemption action an offer gets (brief §8). Labels are decided here so every
 * card, detail page and test agrees.
 */
import type { Availability, OfferType, StudentAction } from "@/lib/enums";

export type RedemptionKind = "reveal" | "claim" | "none";

export interface RedemptionDecision {
  kind: RedemptionKind;
  label: string;
  /** Secondary action shown beside Reveal Code. */
  secondaryLabel?: string;
  /** Why no action is offered. */
  unavailableReason?: string;
}

export interface RedemptionInput {
  offerType: OfferType;
  availability: Availability;
  studentAction: StudentAction | null;
  studentVerificationProvider: string | null;
  revealableCouponCount: number;
}

export function decideRedemption(input: RedemptionInput): RedemptionDecision {
  if (input.availability === "expired") {
    return { kind: "none", label: "Offer expired", unavailableReason: "This promotion is no longer available." };
  }
  if (input.availability === "paused") {
    return { kind: "none", label: "Offer paused", unavailableReason: "The merchant has paused this promotion." };
  }

  switch (input.offerType) {
    case "coupon":
      if (input.revealableCouponCount > 0) {
        return { kind: "reveal", label: "Reveal Code", secondaryLabel: "Visit website" };
      }
      return { kind: "claim", label: "Visit website" };
    case "student":
      return { kind: "claim", label: studentLabel(input.studentAction, input.studentVerificationProvider) };
    case "free_trial":
      return { kind: "claim", label: "Start free trial" };
    case "promo_credit":
      return { kind: "claim", label: "Claim credits" };
    case "lifetime":
      return { kind: "claim", label: "View lifetime deal" };
    case "direct":
      return { kind: "claim", label: "Claim Deal" };
  }
}

function studentLabel(action: StudentAction | null, provider: string | null): string {
  const resolved = action ?? (provider ? "verify" : "claim");
  switch (resolved) {
    case "verify":
      return "Verify student eligibility";
    case "view":
      return "View student discount";
    case "claim":
      return "Claim student offer";
  }
}
