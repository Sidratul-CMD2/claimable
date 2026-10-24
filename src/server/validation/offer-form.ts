/**
 * Converts the admin offer form (FormData) into the shape validated by offerInputSchema, and
 * converts stored rules back into the form's text fields.
 */
import { CONDITION_KINDS } from "@/lib/enums";
import { isCountryCode, REGION_GROUPS } from "@/lib/countries";
import { toMinorUnits } from "./admin";

type RuleInput = { scope: "global" | "region" | "country"; countryCode: string | null; regionCode: string | null; status: string; note: string; sourceUrl: string | null };

const STATUS_FIELDS = [
  ["eligibleCountries", "confirmed_eligible"],
  ["likelyCountries", "likely_eligible"],
  ["unknownCountries", "unknown"],
  ["ineligibleCountries", "confirmed_ineligible"],
] as const;

export function parseRuleTokens(text: string): { rules: Omit<RuleInput, "status" | "note" | "sourceUrl">[]; invalid: string[] } {
  const rules: Omit<RuleInput, "status" | "note" | "sourceUrl">[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.trim().toUpperCase();
    if (!token) continue;
    if (token === "GLOBAL" || token === "WORLDWIDE" || token === "ALL") rules.push({ scope: "global", countryCode: null, regionCode: null });
    else if (REGION_GROUPS[token]) rules.push({ scope: "region", countryCode: null, regionCode: token });
    else if (isCountryCode(token)) rules.push({ scope: "country", countryCode: token, regionCode: null });
    else invalid.push(raw);
  }
  return { rules, invalid };
}

export function offerFormToInput(fd: FormData): { input: Record<string, unknown>; formErrors: Record<string, string[]> } {
  const str = (k: string) => {
    const v = fd.get(k);
    return v == null ? "" : String(v);
  };
  const currency = str("currency").trim().toUpperCase() || null;
  const money = (k: string) => toMinorUnits(fd.get(k), currency && /^[A-Z]{3}$/.test(currency) ? currency : null);
  const formErrors: Record<string, string[]> = {};

  const rules: RuleInput[] = [];
  const note = str("eligibilityNote").trim();
  const sourceUrl = str("eligibilitySourceUrl").trim() || null;
  for (const [field, status] of STATUS_FIELDS) {
    const { rules: parsed, invalid } = parseRuleTokens(str(field));
    if (invalid.length) formErrors[field] = [`Unknown codes: ${invalid.join(", ")}. Use ISO country codes (e.g. US, BD), EU, EEA or GLOBAL.`];
    for (const r of parsed) rules.push({ ...r, status, note, sourceUrl });
  }

  const conditions = CONDITION_KINDS.filter((kind) => fd.get(`condition_${kind}`) === "on").map((kind) => ({
    kind,
    description: str(`conditionNote_${kind}`).trim(),
  }));

  for (const k of ["promoPrice", "upfrontPayment", "renewalPrice", "creditAmount"]) {
    if (Number.isNaN(money(k))) formErrors[`${k}Minor`] = ["Enter an amount like 9.99"];
  }

  const input: Record<string, unknown> = {
    companyId: str("companyId"),
    productId: str("productId"),
    planId: str("planId"),
    slug: str("slug"),
    title: str("title"),
    benefit: str("benefit"),
    summary: str("summary"),
    offerType: str("offerType"),
    availability: str("availability") || "unknown",
    riskTier: str("riskTier") || "standard",
    customerEligibility: str("customerEligibility") || "unknown",
    studentRequired: fd.get("studentRequired") === "on",
    studentAction: str("studentAction"),
    studentVerificationProvider: str("studentVerificationProvider"),
    studentEmailRequired: str("studentEmailRequired") || "unknown",
    studentRequirements: str("studentRequirements"),
    institutionTypes: str("institutionTypes"),
    maxEligibleDuration: str("maxEligibleDuration"),
    verificationRenewal: str("verificationRenewal"),
    defaultCountryStatus: str("defaultCountryStatus") || "unknown",
    currency: currency ?? "",
    promoPriceMinor: Number.isNaN(money("promoPrice")) ? "" : money("promoPrice"),
    promoInterval: str("promoInterval"),
    promoDurationMonths: str("promoDurationMonths"),
    upfrontPaymentMinor: Number.isNaN(money("upfrontPayment")) ? "" : money("upfrontPayment"),
    renewalPriceMinor: Number.isNaN(money("renewalPrice")) ? "" : money("renewalPrice"),
    renewalInterval: str("renewalInterval"),
    autoRenews: str("autoRenews") || "unknown",
    cancellationTerms: str("cancellationTerms"),
    taxNote: str("taxNote"),
    paymentMethodNote: str("paymentMethodNote"),
    appliesToExistingAccounts: str("appliesToExistingAccounts") || "unknown",
    advertisedDiscountPercent: str("advertisedDiscountPercent"),
    trialDays: str("trialDays"),
    creditAmountMinor: Number.isNaN(money("creditAmount")) ? "" : money("creditAmount"),
    creditValidity: str("creditValidity"),
    lifetimeTerms: str("lifetimeTerms"),
    redemptionUrl: str("redemptionUrl"),
    isAffiliate: fd.get("isAffiliate") === "on",
    affiliateDisclosure: str("affiliateDisclosure"),
    isSponsored: fd.get("isSponsored") === "on",
    startsAt: str("startsAt"),
    endsAt: str("endsAt"),
    endsAtConfirmed: fd.get("endsAtConfirmed") === "on",
    officialTermsUrl: str("officialTermsUrl"),
    termsSummary: str("termsSummary"),
    knownLimitations: str("knownLimitations"),
    platforms: fd.getAll("platforms").map(String),
    monitorIntervalHours: str("monitorIntervalHours"),
    categoryIds: fd.getAll("categoryIds").map(String),
    rules,
    conditions,
    allowDuplicate: fd.get("allowDuplicate") === "on",
  };
  return { input, formErrors };
}

/** Stored rules → the four text fields of the form. */
export function rulesToFormFields(rules: { scope: string; countryCode: string | null; regionCode: string | null; status: string; note?: string | null; sourceUrl?: string | null }[]) {
  const fields: Record<string, string> = { eligibleCountries: "", likelyCountries: "", unknownCountries: "", ineligibleCountries: "", eligibilityNote: "", eligibilitySourceUrl: "" };
  for (const [field, status] of STATUS_FIELDS) {
    fields[field] = rules
      .filter((r) => r.status === status)
      .map((r) => (r.scope === "global" ? "GLOBAL" : r.scope === "region" ? r.regionCode : r.countryCode))
      .filter(Boolean)
      .join(", ");
  }
  fields.eligibilityNote = rules.find((r) => r.note)?.note ?? "";
  fields.eligibilitySourceUrl = rules.find((r) => r.sourceUrl)?.sourceUrl ?? "";
  return fields;
}

/** Minor units → decimal string for form inputs. */
export function fromMinorUnits(amount: number | null, currency: string | null): string {
  if (amount == null) return "";
  const digits = currency ? (new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2) : 2;
  return (amount / 10 ** digits).toFixed(digits);
}
