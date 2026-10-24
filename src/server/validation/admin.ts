/**
 * Server-side validation for admin input. Forms post strings; these schemas coerce and
 * enforce invariants (e.g. a price needs a currency and interval). Empty strings mean unknown.
 */
import { z } from "zod";
import {
  AVAILABILITIES,
  BILLING_INTERVALS,
  CONDITION_KINDS,
  COUNTRY_STATUSES,
  COUPON_STATUSES,
  CUSTOMER_ELIGIBILITIES,
  EVENT_KINDS,
  OCCASIONS,
  OFFER_TYPES,
  PLATFORMS,
  RISK_TIERS,
  RULE_SCOPES,
  SOURCE_TYPES,
  STUDENT_ACTIONS,
  TRI_STATES,
  USER_ROLES,
  VERIFICATION_METHODS,
  VERIFICATION_STATES,
} from "@/lib/enums";
import { isCountryCode } from "@/lib/countries";
import { isSafePublicUrl } from "../domain/url-safety";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Missing values and empty form strings both mean "unknown" (NULL). */
const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);
const optionalText = (max = 2000) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
const optionalInt = (min: number, max: number) => z.preprocess(emptyToNull, z.coerce.number().int().min(min).max(max).nullable());
const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => isSafePublicUrl(v), "Must be a public https URL without credentials.");
const optionalHttpsUrl = z.preprocess(emptyToNull, httpsUrl.nullable());
const optionalDate = z.preprocess(emptyToNull, z.coerce.date().nullable());
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(emptyToNull, z.enum(values).nullable());

export const countryRuleSchema = z
  .object({
    scope: z.enum(RULE_SCOPES),
    countryCode: z.string().length(2).toUpperCase().nullable(),
    regionCode: z.string().max(10).nullable(),
    status: z.enum(COUNTRY_STATUSES),
    note: z.string().max(500).default(""),
    sourceUrl: optionalHttpsUrl.default(null),
  })
  .refine((r) => (r.scope === "country" ? !!r.countryCode && isCountryCode(r.countryCode) : true), "Unknown country code.")
  .refine((r) => (r.scope === "region" ? !!r.regionCode : true), "Region code required.");

export const offerInputSchema = z
  .object({
    companyId: z.uuid(),
    productId: z.preprocess(emptyToNull, z.uuid().nullable()),
    planId: z.preprocess(emptyToNull, z.uuid().nullable()),
    slug: z.preprocess(emptyToNull, z.string().regex(SLUG_RE, "Use lowercase letters, numbers and hyphens.").max(120).nullable()),
    title: z.string().trim().min(3).max(160),
    benefit: z.string().trim().min(2).max(120),
    summary: z.string().trim().max(1000).default(""),
    offerType: z.enum(OFFER_TYPES),
    availability: z.enum(AVAILABILITIES).default("unknown"),
    riskTier: z.enum(RISK_TIERS).default("standard"),
    customerEligibility: z.enum(CUSTOMER_ELIGIBILITIES).default("unknown"),
    studentRequired: checkbox,
    studentAction: optionalEnum(STUDENT_ACTIONS),
    studentVerificationProvider: optionalText(120),
    studentEmailRequired: z.enum(TRI_STATES).default("unknown"),
    studentRequirements: optionalText(2000),
    institutionTypes: optionalText(500),
    maxEligibleDuration: optionalText(200),
    verificationRenewal: optionalText(500),
    defaultCountryStatus: z.enum(COUNTRY_STATUSES).default("unknown"),
    currency: z.preprocess(emptyToNull, z.string().regex(/^[A-Za-z]{3}$/).toUpperCase().nullable()),
    promoPriceMinor: optionalInt(0, 100_000_000),
    promoInterval: optionalEnum(BILLING_INTERVALS),
    promoDurationMonths: optionalInt(1, 120),
    upfrontPaymentMinor: optionalInt(0, 100_000_000),
    renewalPriceMinor: optionalInt(0, 100_000_000),
    renewalInterval: optionalEnum(BILLING_INTERVALS),
    autoRenews: z.enum(TRI_STATES).default("unknown"),
    cancellationTerms: optionalText(1000),
    taxNote: optionalText(500),
    paymentMethodNote: optionalText(500),
    appliesToExistingAccounts: z.enum(TRI_STATES).default("unknown"),
    advertisedDiscountPercent: optionalInt(1, 100),
    trialDays: optionalInt(1, 365),
    creditAmountMinor: optionalInt(0, 100_000_000),
    creditValidity: optionalText(300),
    lifetimeTerms: optionalText(1000),
    redemptionUrl: httpsUrl,
    isAffiliate: checkbox,
    affiliateDisclosure: optionalText(500),
    isSponsored: checkbox,
    startsAt: optionalDate,
    endsAt: optionalDate,
    endsAtConfirmed: checkbox,
    officialTermsUrl: optionalHttpsUrl,
    termsSummary: optionalText(2000),
    knownLimitations: optionalText(2000),
    platforms: z.array(z.enum(PLATFORMS)).default([]),
    monitorIntervalHours: optionalInt(1, 24 * 30),
    categoryIds: z.array(z.uuid()).default([]),
    rules: z.array(countryRuleSchema).default([]),
    conditions: z.array(z.object({ kind: z.enum(CONDITION_KINDS), description: z.string().trim().max(500).default("") })).default([]),
    allowDuplicate: checkbox.default(false),
  })
  .superRefine((o, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const anyPrice = [o.promoPriceMinor, o.upfrontPaymentMinor, o.renewalPriceMinor, o.creditAmountMinor].some((v) => v != null);
    if (anyPrice && !o.currency) issue("currency", "A currency is required when any amount is entered.");
    if (o.promoPriceMinor != null && !o.promoInterval) issue("promoInterval", "Billing interval is required with a promotional price.");
    if (o.renewalPriceMinor != null && !o.renewalInterval) issue("renewalInterval", "Renewal interval is required with a renewal price.");
    if (o.startsAt && o.endsAt && o.endsAt < o.startsAt) issue("endsAt", "End date is before the start date.");
    if (o.endsAtConfirmed && !o.endsAt) issue("endsAt", "Enter the end date before marking it confirmed.");
    if (o.isAffiliate && !o.affiliateDisclosure) issue("affiliateDisclosure", "Affiliate links need a disclosure.");
    if (o.offerType === "free_trial" && !o.trialDays) issue("trialDays", "Free trials need the trial length.");
  });

export type OfferInput = z.infer<typeof offerInputSchema>;

export const companyInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.preprocess(emptyToNull, z.string().regex(SLUG_RE).max(80).nullable()),
  websiteUrl: httpsUrl,
  description: z.string().trim().max(1000).default(""),
  allowedDomains: z
    .array(z.string().trim().toLowerCase().regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/, "Enter bare domains like example.com"))
    .min(1, "At least one approved redirect domain is required."),
  categoryIds: z.array(z.uuid()).default([]),
  logoUrl: optionalHttpsUrl,
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export const productInputSchema = z.object({
  companyId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.preprocess(emptyToNull, z.string().regex(SLUG_RE).max(80).nullable()),
  description: z.string().trim().max(1000).default(""),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
});

export const planInputSchema = z.object({
  productId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.preprocess(emptyToNull, z.string().regex(SLUG_RE).max(80).nullable()),
  audience: z.enum(["individual", "team", "business", "education", "family"]).default("individual"),
  officialPricingUrl: optionalHttpsUrl,
  notes: z.string().trim().max(1000).default(""),
});

export const listPriceInputSchema = z.object({
  planId: z.uuid(),
  amountMinor: z.coerce.number().int().min(0).max(100_000_000),
  currency: z.string().regex(/^[A-Za-z]{3}$/).toUpperCase(),
  interval: z.enum(BILLING_INTERVALS),
  countryCode: z.preprocess(emptyToNull, z.string().length(2).toUpperCase().refine(isCountryCode).nullable()),
  observedAt: z.coerce.date(),
  sourceUrl: optionalHttpsUrl,
  isReliable: checkbox,
  note: z.string().trim().max(500).default(""),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().regex(SLUG_RE).max(60),
  description: z.string().trim().max(500).default(""),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isVisible: checkbox,
});

export const couponInputSchema = z.object({
  offerId: z.uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "Codes may contain letters, numbers, dot, dash and underscore."),
  status: z.enum(COUPON_STATUSES).default("unverified"),
  description: z.string().trim().max(300).default(""),
  sourceUrl: optionalHttpsUrl,
});

export const sourceInputSchema = z.object({
  offerId: z.uuid(),
  url: httpsUrl,
  sourceType: z.enum(SOURCE_TYPES),
  title: z.string().trim().max(200).default(""),
  publisher: z.string().trim().max(120).default(""),
  isOfficial: checkbox,
  role: z.enum(["terms", "pricing", "student_terms", "coupon", "discovery", "supporting"]).default("supporting"),
  expectedMarkers: z.array(z.string().trim().min(2).max(120)).max(10).default([]),
});

export const verificationInputSchema = z
  .object({
    offerId: z.uuid(),
    couponId: z.preprocess(emptyToNull, z.uuid().nullable()),
    state: z.enum(VERIFICATION_STATES),
    method: z.enum(VERIFICATION_METHODS),
    countryCode: z.preprocess(emptyToNull, z.string().length(2).toUpperCase().refine(isCountryCode).nullable()),
    evidenceUrl: optionalHttpsUrl,
    note: z.string().trim().max(1000).default(""),
    verifiedAt: z.coerce.date(),
  })
  .superRefine((v, ctx) => {
    if (v.state === "redemption_tested" && v.method !== "manual_redemption_test") {
      ctx.addIssue({ code: "custom", path: ["method"], message: "Redemption tested requires a manual redemption test." });
    }
    if (v.state === "redemption_tested" && !v.countryCode) {
      ctx.addIssue({ code: "custom", path: ["countryCode"], message: "Record the country the redemption was tested in." });
    }
    if (v.state !== "unverified" && !v.evidenceUrl && v.method !== "manual_redemption_test") {
      ctx.addIssue({ code: "custom", path: ["evidenceUrl"], message: "Evidence URL is required." });
    }
    if (v.verifiedAt.getTime() > Date.now() + 60_000) {
      ctx.addIssue({ code: "custom", path: ["verifiedAt"], message: "Verification date cannot be in the future." });
    }
  });

export const eventInputSchema = z
  .object({
    companyId: z.uuid(),
    offerId: z.preprocess(emptyToNull, z.uuid().nullable()),
    title: z.string().trim().min(3).max(160),
    kind: z.enum(EVENT_KINDS),
    occasion: z.enum(OCCASIONS),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
    datesApproximate: checkbox,
    sourceUrl: httpsUrl,
    evidenceNote: z.string().trim().max(1000).default(""),
    isPublished: checkbox,
  })
  .superRefine((e, ctx) => {
    if (e.endsOn && e.endsOn < e.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "End is before start." });
    const today = new Date().toISOString().slice(0, 10);
    if (e.kind === "historical" && e.startsOn > today) {
      ctx.addIssue({ code: "custom", path: ["startsOn"], message: "Historical events must have started in the past." });
    }
    if (e.kind === "confirmed" && (e.endsOn ?? e.startsOn) < today) {
      ctx.addIssue({ code: "custom", path: ["kind"], message: "A past event is historical, not confirmed upcoming." });
    }
  });

export const userInputSchema = z.object({
  email: z.email().toLowerCase(),
  name: z.string().trim().min(1).max(80),
  role: z.enum(USER_ROLES),
  password: z.string().min(12).max(200),
});

/** Converts a decimal amount typed by an editor ("4.99") into minor units for the currency. */
export function toMinorUnits(value: FormDataEntryValue | null, currency: string | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  const digits = currency ? (new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2) : 2;
  return Math.round(n * 10 ** digits);
}
