/**
 * Offer lifecycle rules: publication transitions, publish requirements, expiry and archival.
 */
import type { Availability, OfferType, PublicationStatus } from "@/lib/enums";

export const ARCHIVE_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

export const PUBLICATION_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  draft: ["pending_review", "published", "archived"],
  pending_review: ["draft", "published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft", "published"],
};

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return PUBLICATION_TRANSITIONS[from].includes(to);
}

export interface PublishCheckInput {
  title: string;
  benefit: string;
  offerType: OfferType;
  redemptionUrlApproved: boolean;
  sourceCount: number;
  couponCount: number;
  studentRequired: boolean;
  studentRequirements: string | null;
  countryRuleCount: number;
}

/** Problems that block publication. Unverified offers may be published, but never silently. */
export function publishProblems(o: PublishCheckInput): string[] {
  const problems: string[] = [];
  if (!o.title.trim()) problems.push("Title is required.");
  if (!o.benefit.trim()) problems.push("Primary benefit is required.");
  if (!o.redemptionUrlApproved) problems.push("Redemption URL must be https on one of the company's approved domains.");
  if (o.sourceCount === 0) problems.push("At least one source (official terms or evidence) is required.");
  if (o.offerType === "coupon" && o.couponCount === 0) problems.push("Coupon offers need at least one code.");
  if ((o.offerType === "student" || o.studentRequired) && !o.studentRequirements?.trim()) {
    problems.push("Student offers must describe the educational eligibility requirements.");
  }
  return problems;
}

export type ExpiryDecision = "expire" | "flag_unconfirmed_end" | "none";

/** Only a confirmed end date in the past expires an offer automatically. */
export function expiryDecision(
  o: { availability: Availability; endsAt: Date | null; endsAtConfirmed: boolean },
  now: Date = new Date(),
): ExpiryDecision {
  if (o.availability === "expired" || !o.endsAt) return "none";
  if (o.endsAt.getTime() > now.getTime()) return "none";
  return o.endsAtConfirmed ? "expire" : "flag_unconfirmed_end";
}

/** Expired offers leave public listings after a grace period but keep their history. */
export function shouldArchive(
  o: { availability: Availability; publicationStatus: PublicationStatus; expiredSince: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    o.availability === "expired" &&
    o.publicationStatus === "published" &&
    !!o.expiredSince &&
    now.getTime() - o.expiredSince.getTime() >= ARCHIVE_AFTER_DAYS * DAY_MS
  );
}
