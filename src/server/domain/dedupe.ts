/**
 * Duplicate detection (brief §17).
 *
 * Two offers are equivalent when they are for the same company/product/plan, have the same
 * type, code, redemption destination, discount terms, eligibility and date range. Offers that
 * differ in eligibility or redemption path are deliberately NOT equivalent.
 */
import { createHash } from "node:crypto";
import type { CountryStatus, CustomerEligibility, OfferType, RuleScope } from "@/lib/enums";
import { normalizeUrlForComparison } from "./url-safety";

export interface DedupeInput {
  companyId: string;
  productId: string | null;
  planId: string | null;
  offerType: OfferType;
  couponCodes: string[];
  redemptionUrl: string;
  promoPriceMinor: number | null;
  currency: string | null;
  promoInterval: string | null;
  advertisedDiscountPercent: number | null;
  trialDays: number | null;
  creditAmountMinor: number | null;
  studentRequired: boolean;
  customerEligibility: CustomerEligibility;
  countryRules: { scope: RuleScope; countryCode: string | null; regionCode: string | null; status: CountryStatus }[];
  startsAt: Date | null;
  endsAt: Date | null;
}

export function dedupeSignature(o: DedupeInput): string {
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const rules = o.countryRules
    .map((r) => `${r.scope}:${r.countryCode ?? r.regionCode ?? "*"}:${r.status}`)
    .sort()
    .join(",");
  return [
    o.companyId,
    o.productId ?? "",
    o.planId ?? "",
    o.offerType,
    o.couponCodes.map((c) => c.trim().toUpperCase()).sort().join("|"),
    normalizeUrlForComparison(o.redemptionUrl),
    `${o.promoPriceMinor ?? ""}${o.currency ?? ""}/${o.promoInterval ?? ""}`,
    o.advertisedDiscountPercent ?? "",
    o.trialDays ?? "",
    o.creditAmountMinor ?? "",
    o.studentRequired ? "student" : "",
    o.customerEligibility,
    rules,
    day(o.startsAt),
    day(o.endsAt),
  ].join("#");
}

export function dedupeKey(o: DedupeInput): string {
  return createHash("sha256").update(dedupeSignature(o)).digest("hex").slice(0, 32);
}

export function areEquivalent(a: DedupeInput, b: DedupeInput): boolean {
  return dedupeSignature(a) === dedupeSignature(b);
}

/**
 * Looser similarity used to flag *possible* duplicates for human review
 * (same company + type + redemption destination), without merging automatically.
 */
export function possibleDuplicate(a: DedupeInput, b: DedupeInput): boolean {
  return (
    a.companyId === b.companyId &&
    a.offerType === b.offerType &&
    normalizeUrlForComparison(a.redemptionUrl) === normalizeUrlForComparison(b.redemptionUrl)
  );
}
