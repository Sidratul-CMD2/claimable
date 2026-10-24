/**
 * Country and user eligibility decisions (brief §10 and §16).
 *
 * Country status keeps the four tentative states from §10 ("likely eligible" is never promoted
 * to confirmed). User eligibility uses the §16 vocabulary and is derived from country status
 * plus audience requirements. Technical availability of a page is irrelevant here.
 */
import type { CountryStatus, CustomerEligibility, RuleScope } from "@/lib/enums";

export interface CountryRule {
  scope: RuleScope;
  countryCode: string | null;
  regionCode: string | null;
  status: CountryStatus;
  note?: string | null;
}

export type CountryStatusOrNone = CountryStatus | "not_selected";

export interface CountryEligibility {
  status: CountryStatusOrNone;
  /** Which rule produced the status, for transparent display. */
  basis: "country_rule" | "region_rule" | "global_rule" | "default" | "no_country";
  regionCode?: string | null;
  note?: string | null;
}

/**
 * Most specific rule wins: country → region → global → offer default.
 * Within the same specificity, a confirmed-ineligible rule beats any other status
 * (conservative: never overstate eligibility when sources conflict).
 */
export function evaluateCountryEligibility(
  rules: CountryRule[],
  defaultStatus: CountryStatus,
  countryCode: string | null | undefined,
  regionsOfCountry: (code: string) => string[] = () => [],
): CountryEligibility {
  if (!countryCode) return { status: "not_selected", basis: "no_country" };
  const code = countryCode.toUpperCase();

  const countryRules = rules.filter((r) => r.scope === "country" && r.countryCode?.toUpperCase() === code);
  if (countryRules.length) {
    const rule = pickConservative(countryRules);
    return { status: rule.status, basis: "country_rule", note: rule.note ?? null };
  }

  const regions = new Set(regionsOfCountry(code));
  const regionRules = rules.filter((r) => r.scope === "region" && r.regionCode && regions.has(r.regionCode));
  if (regionRules.length) {
    const rule = pickConservative(regionRules);
    return { status: rule.status, basis: "region_rule", regionCode: rule.regionCode, note: rule.note ?? null };
  }

  const globalRules = rules.filter((r) => r.scope === "global");
  if (globalRules.length) {
    const rule = pickConservative(globalRules);
    return { status: rule.status, basis: "global_rule", note: rule.note ?? null };
  }

  return { status: defaultStatus, basis: "default" };
}

const CONSERVATIVE_ORDER: CountryStatus[] = ["confirmed_ineligible", "unknown", "likely_eligible", "confirmed_eligible"];

function pickConservative(rules: CountryRule[]): CountryRule {
  return [...rules].sort((a, b) => CONSERVATIVE_ORDER.indexOf(a.status) - CONSERVATIVE_ORDER.indexOf(b.status))[0];
}

/** True when the offer is confirmed for every country (a global confirmed rule with no exclusions). */
export function isConfirmedWorldwide(rules: CountryRule[]): boolean {
  const global = rules.filter((r) => r.scope === "global");
  return (
    global.length > 0 &&
    global.every((r) => r.status === "confirmed_eligible") &&
    !rules.some((r) => r.scope !== "global" && r.status !== "confirmed_eligible")
  );
}

export type UserEligibilityStatus = "eligible" | "ineligible" | "unknown" | "requires_verification";

export interface UserEligibilityInput {
  country: CountryEligibility;
  studentRequired: boolean;
  customerEligibility: CustomerEligibility;
  /** Other audience requirements that need confirmation with the merchant or a provider. */
  hasVerificationRequirement?: boolean;
}

export interface UserEligibility {
  status: UserEligibilityStatus;
  country: CountryEligibility;
  /** Conditions the visitor must satisfy, shown before Claim. */
  conditions: string[];
}

export function evaluateUserEligibility(input: UserEligibilityInput): UserEligibility {
  const conditions: string[] = [];
  if (input.studentRequired) conditions.push("student");
  if (input.customerEligibility === "new_customers") conditions.push("new_customers");
  if (input.customerEligibility === "existing_customers") conditions.push("existing_customers");

  const countryStatus = input.country.status;
  if (countryStatus === "confirmed_ineligible") {
    return { status: "ineligible", country: input.country, conditions };
  }
  if (countryStatus !== "confirmed_eligible") {
    // not_selected, unknown and likely_eligible all remain "unknown" for the visitor.
    return { status: "unknown", country: input.country, conditions };
  }
  if (input.studentRequired || input.hasVerificationRequirement) {
    return { status: "requires_verification", country: input.country, conditions };
  }
  return { status: "eligible", country: input.country, conditions };
}

/** Sort weight for discovery: confirmed first, uncertain next, ineligible last. */
export function countryStatusRank(status: CountryStatusOrNone): number {
  switch (status) {
    case "confirmed_eligible":
      return 0;
    case "likely_eligible":
      return 1;
    case "unknown":
    case "not_selected":
      return 2;
    case "confirmed_ineligible":
      return 3;
  }
}
