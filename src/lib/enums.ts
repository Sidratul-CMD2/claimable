/** Enum values shared by the database schema, domain rules and UI. */

export const USER_ROLES = ["admin", "editor"] as const;
export const PUBLICATION_STATUSES = ["draft", "pending_review", "published", "archived"] as const;
export const AVAILABILITIES = ["active", "expired", "paused", "unknown"] as const;
export const VERIFICATION_STATES = ["officially_confirmed", "redemption_tested", "evidence_supported", "unverified"] as const;
export const OFFER_TYPES = ["coupon", "direct", "student", "free_trial", "lifetime", "promo_credit"] as const;
export const CUSTOMER_ELIGIBILITIES = ["all", "new_customers", "existing_customers", "unknown"] as const;
export const TRI_STATES = ["yes", "no", "unknown"] as const;
export const COUNTRY_STATUSES = ["confirmed_eligible", "confirmed_ineligible", "likely_eligible", "unknown"] as const;
export const RULE_SCOPES = ["global", "region", "country"] as const;
export const BILLING_INTERVALS = ["day", "week", "month", "year", "one_time"] as const;
export const RISK_TIERS = ["high", "standard", "evergreen"] as const;
export const STUDENT_ACTIONS = ["claim", "verify", "view"] as const;
export const COUPON_STATUSES = ["unverified", "officially_published", "redemption_tested", "expired", "invalid"] as const;
export const SOURCE_TYPES = [
  "official_promo_page",
  "official_pricing_page",
  "official_student_page",
  "official_announcement",
  "official_terms",
  "official_feed",
  "partner_feed",
  "affiliate_program",
  "newsletter",
  "community_submission",
  "marketplace_listing",
  "editorial",
  "third_party_signal",
] as const;
export const OBSERVATION_OUTCOMES = [
  "ok",
  "changed",
  "markers_missing",
  "not_found",
  "redirected",
  "blocked",
  "robots_disallowed",
  "error",
  "timeout",
  "skipped",
] as const;
export const VERIFICATION_METHODS = [
  "editorial_official_page_review",
  "automated_official_page_check",
  "manual_redemption_test",
  "partner_feed",
  "user_report_review",
  "admin_correction",
] as const;
export const PRICE_KINDS = ["list", "promotional", "renewal"] as const;
export const REPORT_REASONS = [
  "code_not_working",
  "promotion_expired",
  "wrong_discount",
  "country_unavailable",
  "student_verification_failed",
  "broken_link",
  "incorrect_renewal_info",
  "other",
] as const;
export const REPORT_STATUSES = ["open", "resolved_valid", "resolved_invalid", "dismissed"] as const;
export const SUBMISSION_STATUSES = ["new", "accepted", "rejected", "duplicate"] as const;
export const CANDIDATE_STATUSES = ["new", "promoted", "dismissed", "duplicate"] as const;
export const REVIEW_STATUSES = ["open", "resolved", "dismissed"] as const;
export const REVIEW_KINDS = [
  "repeated_failures",
  "page_not_found",
  "markers_missing",
  "redirect_changed",
  "blocked_source",
  "robots_disallowed",
  "unconfirmed_end_date_passed",
  "stale_verification",
  "conflicting_sources",
  "user_reports",
  "submission",
  "discovery_candidate",
  "duplicate_candidate",
] as const;
export const CONNECTOR_KINDS = ["monitor", "discovery", "feed"] as const;
export const PERMISSION_STATUSES = ["approved", "pending", "not_configured", "revoked"] as const;
export const JOB_KINDS = ["offer_check", "connector_run", "expire_offers", "archive_expired", "stale_scan"] as const;
export const RUN_STATUSES = ["success", "failure", "timeout", "skipped"] as const;
export const EVENT_KINDS = ["confirmed", "historical"] as const;
export const OCCASIONS = [
  "black_friday",
  "cyber_monday",
  "back_to_school",
  "new_year",
  "anniversary",
  "seasonal",
  "product_launch",
  "student_period",
  "holiday",
  "other",
] as const;
export const ANALYTICS_TYPES = ["search", "offer_view", "reveal", "copy", "claim", "report", "submission"] as const;
export const CONDITION_KINDS = [
  "new_customers_only",
  "existing_subscribers_only",
  "payment_method",
  "app_store_billing",
  "web_billing_only",
  "referral_required",
  "minimum_spend",
  "no_stacking",
  "limited_redemptions",
  "individual_plan_only",
  "business_plan_only",
  "institution_eligibility",
  "age_requirement",
  "account_requirement",
  "other",
] as const;
export const PLATFORMS = ["web", "windows", "macos", "linux", "ios", "android"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type Availability = (typeof AVAILABILITIES)[number];
export type VerificationState = (typeof VERIFICATION_STATES)[number];
export type OfferType = (typeof OFFER_TYPES)[number];
export type CustomerEligibility = (typeof CUSTOMER_ELIGIBILITIES)[number];
export type TriState = (typeof TRI_STATES)[number];
export type CountryStatus = (typeof COUNTRY_STATUSES)[number];
export type RuleScope = (typeof RULE_SCOPES)[number];
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export type RiskTier = (typeof RISK_TIERS)[number];
export type StudentAction = (typeof STUDENT_ACTIONS)[number];
export type CouponStatus = (typeof COUPON_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ObservationOutcome = (typeof OBSERVATION_OUTCOMES)[number];
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
export type PriceKind = (typeof PRICE_KINDS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export type JobKind = (typeof JOB_KINDS)[number];
export type EventKind = (typeof EVENT_KINDS)[number];
export type Occasion = (typeof OCCASIONS)[number];
export type AnalyticsType = (typeof ANALYTICS_TYPES)[number];
export type ConditionKind = (typeof CONDITION_KINDS)[number];
export type Platform = (typeof PLATFORMS)[number];
