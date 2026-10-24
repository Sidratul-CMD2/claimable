/**
 * User-facing vocabulary for status values. Decisions come from src/server/domain; this file
 * only turns them into words. Wording avoids overclaiming ("Verified working" is never used).
 */
import type {
  Availability,
  ConditionKind,
  CountryStatus,
  CouponStatus,
  CustomerEligibility,
  Occasion,
  OfferType,
  PublicationStatus,
  ReportReason,
  SourceType,
  VerificationMethod,
} from "./enums";

export type Tone = "positive" | "info" | "caution" | "warning" | "negative" | "neutral" | "accent";

export const OFFER_TYPE_LABEL: Record<OfferType, string> = {
  coupon: "Coupon",
  direct: "Direct deal",
  student: "Student offer",
  free_trial: "Free trial",
  lifetime: "Lifetime deal",
  promo_credit: "Promotional credit",
};

export const OFFER_TYPE_PLURAL: Record<OfferType, string> = {
  coupon: "Coupons",
  direct: "Direct deals",
  student: "Student offers",
  free_trial: "Free trials",
  lifetime: "Lifetime deals",
  promo_credit: "Promotional credits",
};

export const VERIFICATION_LABEL: Record<string, { label: string; tone: Tone; description: string }> = {
  officially_confirmed: {
    label: "Officially confirmed",
    tone: "positive",
    description: "The terms were observed on a page controlled by the company. This does not prove every code or country works.",
  },
  redemption_tested: {
    label: "Redemption tested",
    tone: "positive",
    description: "Someone completed redemption on the stated date and country. It may not work for every account or country.",
  },
  evidence_supported: {
    label: "Evidence supported",
    tone: "info",
    description: "Supported by credible evidence that is not an official company statement.",
  },
  unverified: {
    label: "Unverified",
    tone: "caution",
    description: "We have not yet confirmed this offer. Check the merchant's terms before relying on it.",
  },
  stale: {
    label: "Verification stale",
    tone: "warning",
    description: "Our last confirmation is older than our freshness window for this kind of offer. It may have changed.",
  },
};

export const AVAILABILITY_LABEL: Record<Availability, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "positive" },
  expired: { label: "Expired", tone: "negative" },
  paused: { label: "Paused", tone: "caution" },
  unknown: { label: "Availability unknown", tone: "neutral" },
};

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  archived: "Archived",
};

export const COUNTRY_STATUS_LABEL: Record<CountryStatus | "not_selected", { label: string; short: string; tone: Tone }> = {
  confirmed_eligible: { label: "Confirmed eligible in your country", short: "Available in", tone: "positive" },
  confirmed_ineligible: { label: "Not available in your country", short: "Not available in", tone: "negative" },
  likely_eligible: { label: "Likely eligible, pending verification", short: "Likely in", tone: "info" },
  unknown: { label: "Country eligibility not confirmed", short: "Not confirmed for", tone: "neutral" },
  not_selected: { label: "Select your country to check eligibility", short: "Choose country", tone: "neutral" },
};

/** Labels for rule lists on detail pages (no "your country" phrasing). */
export const RULE_STATUS_LABEL: Record<CountryStatus, string> = {
  confirmed_eligible: "Confirmed eligible",
  confirmed_ineligible: "Confirmed not eligible",
  likely_eligible: "Likely eligible, pending verification",
  unknown: "Eligibility unknown",
};

/** The overall verdict for the visitor; phrased as "your" so it isn't read as a country rule. */
export const USER_ELIGIBILITY_LABEL: Record<string, { label: string; tone: Tone }> = {
  eligible: { label: "Eligible for you", tone: "positive" },
  ineligible: { label: "Not eligible for you", tone: "negative" },
  unknown: { label: "Your eligibility: not confirmed", tone: "neutral" },
  requires_verification: { label: "Needs verification to claim", tone: "accent" },
};

export const CUSTOMER_LABEL: Record<CustomerEligibility, string> = {
  all: "New and existing customers",
  new_customers: "New customers only",
  existing_customers: "Existing customers only",
  unknown: "Customer eligibility not stated",
};

export const CONDITION_LABEL: Record<ConditionKind, string> = {
  new_customers_only: "New customers only",
  existing_subscribers_only: "Existing subscribers only",
  payment_method: "Payment method restriction",
  app_store_billing: "Not available through app-store billing",
  web_billing_only: "Website billing only",
  referral_required: "Referral required",
  minimum_spend: "Minimum spend",
  no_stacking: "Cannot be combined with other offers",
  limited_redemptions: "Limited redemptions",
  individual_plan_only: "Individual plans only",
  business_plan_only: "Business plans only",
  institution_eligibility: "Institution must be eligible",
  age_requirement: "Age requirement",
  account_requirement: "Account requirement",
  other: "Other condition",
};

export const COUPON_STATUS_LABEL: Record<CouponStatus, { label: string; tone: Tone }> = {
  unverified: { label: "Code not yet verified", tone: "caution" },
  officially_published: { label: "Published by the merchant", tone: "positive" },
  redemption_tested: { label: "Redemption tested", tone: "positive" },
  expired: { label: "Expired code", tone: "negative" },
  invalid: { label: "Invalid code", tone: "negative" },
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  official_promo_page: "Official promotion page",
  official_pricing_page: "Official pricing page",
  official_student_page: "Official student page",
  official_announcement: "Official announcement",
  official_terms: "Official terms",
  official_feed: "Official feed",
  partner_feed: "Authorized partner feed",
  affiliate_program: "Affiliate program",
  newsletter: "Newsletter",
  community_submission: "Community submission",
  marketplace_listing: "Marketplace listing",
  editorial: "Editorial research",
  third_party_signal: "Third-party signal (discovery only)",
};

export const VERIFICATION_METHOD_LABEL: Record<VerificationMethod, string> = {
  editorial_official_page_review: "Editor reviewed the official page",
  automated_official_page_check: "Automated check of the official page",
  manual_redemption_test: "Manual redemption test",
  partner_feed: "Authorized partner feed",
  user_report_review: "Reviewed user reports",
  admin_correction: "Administrator correction",
};

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  code_not_working: "Coupon does not work",
  promotion_expired: "Promotion has expired",
  wrong_discount: "Wrong discount amount",
  country_unavailable: "Not available in my country",
  student_verification_failed: "Student verification failed",
  broken_link: "Broken link",
  incorrect_renewal_info: "Incorrect renewal information",
  other: "Something else",
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  black_friday: "Black Friday",
  cyber_monday: "Cyber Monday",
  back_to_school: "Back to school",
  new_year: "New Year",
  anniversary: "Company anniversary",
  seasonal: "Seasonal sale",
  product_launch: "Product launch",
  student_period: "Student registration period",
  holiday: "Holiday sale",
  other: "Promotion",
};

export const TRI_STATE_LABEL = { yes: "Yes", no: "No", unknown: "Not disclosed" } as const;
