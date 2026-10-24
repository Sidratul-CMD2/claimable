/**
 * Database schema. Column names are snake_case in Postgres (Drizzle `casing: "snake_case"`).
 *
 * Invariants (see docs/DATA_MODEL.md and docs/VERIFICATION.md):
 * - Company → product → plan → offer → coupon are distinct records.
 * - Publication status, availability, verification state and eligibility are independent.
 *   "Verification stale" is derived from `verified_at` + risk tier, never stored.
 * - Unknown values are NULL or the explicit `unknown` enum member — never guessed defaults.
 * - History tables (price_points, source_observations, verification_records, offer_revisions,
 *   job_runs, audit_logs) are append-only.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import * as E from "../../lib/enums";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};
const tz = () => timestamp({ withTimezone: true });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", E.USER_ROLES);
export const publicationStatus = pgEnum("publication_status", E.PUBLICATION_STATUSES);
export const availability = pgEnum("availability", E.AVAILABILITIES);
export const verificationState = pgEnum("verification_state", E.VERIFICATION_STATES);
export const offerType = pgEnum("offer_type", E.OFFER_TYPES);
export const customerEligibility = pgEnum("customer_eligibility", E.CUSTOMER_ELIGIBILITIES);
export const triState = pgEnum("tri_state", E.TRI_STATES);
export const countryStatus = pgEnum("country_status", E.COUNTRY_STATUSES);
export const ruleScope = pgEnum("rule_scope", E.RULE_SCOPES);
export const billingInterval = pgEnum("billing_interval", E.BILLING_INTERVALS);
export const riskTier = pgEnum("risk_tier", E.RISK_TIERS);
export const studentAction = pgEnum("student_action", E.STUDENT_ACTIONS);
export const couponStatus = pgEnum("coupon_status", E.COUPON_STATUSES);
export const sourceType = pgEnum("source_type", E.SOURCE_TYPES);
export const observationOutcome = pgEnum("observation_outcome", E.OBSERVATION_OUTCOMES);
export const verificationMethod = pgEnum("verification_method", E.VERIFICATION_METHODS);
export const priceKind = pgEnum("price_kind", E.PRICE_KINDS);
export const reportReason = pgEnum("report_reason", E.REPORT_REASONS);
export const reportStatus = pgEnum("report_status", E.REPORT_STATUSES);
export const submissionStatus = pgEnum("submission_status", E.SUBMISSION_STATUSES);
export const candidateStatus = pgEnum("candidate_status", E.CANDIDATE_STATUSES);
export const reviewStatus = pgEnum("review_status", E.REVIEW_STATUSES);
export const reviewKind = pgEnum("review_kind", E.REVIEW_KINDS);
export const connectorKind = pgEnum("connector_kind", E.CONNECTOR_KINDS);
export const permissionStatus = pgEnum("permission_status", E.PERMISSION_STATUSES);
export const jobKind = pgEnum("job_kind", E.JOB_KINDS);
export const runStatus = pgEnum("run_status", E.RUN_STATUSES);
export const eventKind = pgEnum("event_kind", E.EVENT_KINDS);
export const occasion = pgEnum("occasion", E.OCCASIONS);
export const analyticsType = pgEnum("analytics_type", E.ANALYTICS_TYPES);

// ---------------------------------------------------------------------------
// Staff accounts, sessions, rate limits
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: userRole().notNull().default("editor"),
  lastLoginAt: tz(),
  disabledAt: tz(),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 hex of the cookie token; the raw token is never stored. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tz().notNull(),
    userAgent: text(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  windowStart: tz().notNull(),
  count: integer().notNull().default(0),
});

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const countries = pgTable("countries", {
  code: char({ length: 2 }).primaryKey(),
  name: text().notNull(),
});

export const regionGroups = pgTable("region_groups", {
  code: text().primaryKey(),
  name: text().notNull(),
});

export const regionGroupCountries = pgTable(
  "region_group_countries",
  {
    regionCode: text()
      .notNull()
      .references(() => regionGroups.code, { onDelete: "cascade" }),
    countryCode: char({ length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.regionCode, t.countryCode] })],
);

export const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(""),
  sortOrder: integer().notNull().default(0),
  isVisible: boolean().notNull().default(true),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Company → product → plan
// ---------------------------------------------------------------------------

export const companies = pgTable("companies", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(""),
  websiteUrl: text().notNull(),
  /** Hostnames the outbound redirect may send visitors to (exact host or subdomain). */
  allowedDomains: text().array().notNull().default(sql`'{}'::text[]`),
  /** Only set when the platform has rights to display the mark; otherwise a monogram is shown. */
  logoUrl: text(),
  isFixture: boolean().notNull().default(false),
  ...timestamps,
});

export const companyCategories = pgTable(
  "company_categories",
  {
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.categoryId] })],
);

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    name: text().notNull(),
    description: text().notNull().default(""),
    platforms: text().array().notNull().default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.companyId, t.slug)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    name: text().notNull(),
    /** individual | team | business | education | family — free text kept short. */
    audience: text().notNull().default("individual"),
    officialPricingUrl: text(),
    notes: text().notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.productId, t.slug)],
);

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export const offers = pgTable(
  "offers",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    planId: uuid().references(() => plans.id, { onDelete: "set null" }),

    title: text().notNull(),
    /** Primary benefit, shown dominant on cards, e.g. "Free for 12 months". */
    benefit: text().notNull(),
    summary: text().notNull().default(""),
    offerType: offerType().notNull(),

    // Independent status dimensions
    publicationStatus: publicationStatus().notNull().default("draft"),
    availability: availability().notNull().default("unknown"),
    verificationState: verificationState().notNull().default("unverified"),
    /** When evidence supporting `verification_state` was last confirmed. */
    verifiedAt: tz(),
    /** When any check (successful or not) last ran. */
    lastCheckedAt: tz(),
    riskTier: riskTier().notNull().default("standard"),

    // Audience and eligibility
    customerEligibility: customerEligibility().notNull().default("unknown"),
    studentRequired: boolean().notNull().default(false),
    studentAction: studentAction(),
    studentVerificationProvider: text(),
    studentEmailRequired: triState().notNull().default("unknown"),
    studentRequirements: text(),
    institutionTypes: text(),
    maxEligibleDuration: text(),
    verificationRenewal: text(),
    /** Status for countries without a more specific rule. */
    defaultCountryStatus: countryStatus().notNull().default("unknown"),

    // Pricing — all nullable: NULL means unknown/not disclosed.
    currency: char({ length: 3 }),
    promoPriceMinor: integer(),
    promoInterval: billingInterval(),
    promoDurationMonths: integer(),
    upfrontPaymentMinor: integer(),
    renewalPriceMinor: integer(),
    renewalInterval: billingInterval(),
    autoRenews: triState().notNull().default("unknown"),
    cancellationTerms: text(),
    taxNote: text(),
    paymentMethodNote: text(),
    appliesToExistingAccounts: triState().notNull().default("unknown"),
    /** Discount percentage exactly as the merchant advertises it (displayed as "advertised"). */
    advertisedDiscountPercent: integer(),
    trialDays: integer(),
    creditAmountMinor: integer(),
    creditValidity: text(),
    lifetimeTerms: text(),

    // Redemption
    redemptionUrl: text().notNull(),
    isAffiliate: boolean().notNull().default(false),
    affiliateDisclosure: text(),
    isSponsored: boolean().notNull().default(false),

    // Dates
    startsAt: tz(),
    endsAt: tz(),
    endsAtConfirmed: boolean().notNull().default(false),

    // Terms and evidence summary
    officialTermsUrl: text(),
    termsSummary: text(),
    knownLimitations: text(),
    platforms: text().array().notNull().default(sql`'{}'::text[]`),

    // Operations
    monitorIntervalHours: integer(),
    dedupeKey: text().notNull(),
    canonicalOfferId: uuid(),
    searchText: text().notNull().default(""),
    isFixture: boolean().notNull().default(false),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    publishedAt: tz(),
    archivedAt: tz(),
    ...timestamps,
  },
  (t) => [
    index().on(t.publicationStatus, t.availability),
    index().on(t.companyId),
    index().on(t.dedupeKey),
    index().on(t.endsAt),
    index("offers_search_text_trgm").using("gin", t.searchText.op("gin_trgm_ops")),
  ],
);

/** Append-only price observations for plans (list prices) and offers (promo/renewal). */
export const pricePoints = pgTable(
  "price_points",
  {
    id: uuid().primaryKey().defaultRandom(),
    planId: uuid().references(() => plans.id, { onDelete: "cascade" }),
    offerId: uuid().references(() => offers.id, { onDelete: "cascade" }),
    kind: priceKind().notNull(),
    amountMinor: integer().notNull(),
    currency: char({ length: 3 }).notNull(),
    interval: billingInterval().notNull(),
    countryCode: char({ length: 2 }),
    observedAt: tz().notNull(),
    sourceUrl: text(),
    /** True only for an official price for this exact plan that may anchor savings maths. */
    isReliable: boolean().notNull().default(false),
    note: text().notNull().default(""),
    recordedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    connectorKey: text(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.planId, t.observedAt), index().on(t.offerId, t.observedAt)],
);

export const offerCategories = pgTable(
  "offer_categories",
  {
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.categoryId] })],
);

export const offerCountryRules = pgTable(
  "offer_country_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    scope: ruleScope().notNull(),
    countryCode: char({ length: 2 }).references(() => countries.code),
    regionCode: text().references(() => regionGroups.code),
    status: countryStatus().notNull(),
    note: text().notNull().default(""),
    sourceUrl: text(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [unique().on(t.offerId, t.scope, t.countryCode, t.regionCode).nullsNotDistinct()],
);

export const offerConditions = pgTable(
  "offer_conditions",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    /** See CONDITION_KINDS in src/lib/labels.ts. */
    kind: text().notNull(),
    description: text().notNull().default(""),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.offerId)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    code: text().notNull(),
    status: couponStatus().notNull().default("unverified"),
    description: text().notNull().default(""),
    sourceUrl: text(),
    firstSeenAt: tz(),
    lastSeenAt: tz(),
    lastTestedAt: tz(),
    testCountry: char({ length: 2 }),
    testNote: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.offerId, t.code)],
);

// ---------------------------------------------------------------------------
// Sources, observations, verification, history
// ---------------------------------------------------------------------------

export const sources = pgTable("sources", {
  id: uuid().primaryKey().defaultRandom(),
  url: text().notNull().unique(),
  sourceType: sourceType().notNull(),
  title: text().notNull().default(""),
  publisher: text().notNull().default(""),
  isOfficial: boolean().notNull().default(false),
  connectorKey: text(),
  firstDiscoveredAt: tz().notNull().defaultNow(),
  lastCheckedAt: tz(),
  lastSuccessAt: tz(),
  lastOutcome: observationOutcome(),
  lastHttpStatus: integer(),
  lastContentHash: text(),
  consecutiveFailures: integer().notNull().default(0),
  createdAt: tz().notNull().defaultNow(),
});

export const offerSources = pgTable(
  "offer_sources",
  {
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    sourceId: uuid()
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    /** terms | pricing | student_terms | coupon | discovery | supporting */
    role: text().notNull().default("supporting"),
    /** Phrases expected on the page while the offer is live (case-insensitive). */
    expectedMarkers: text().array().notNull().default(sql`'{}'::text[]`),
    addedAt: tz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.sourceId] })],
);

export const sourceObservations = pgTable(
  "source_observations",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceId: uuid()
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    connectorKey: text().notNull(),
    jobRunId: uuid(),
    observedAt: tz().notNull().defaultNow(),
    outcome: observationOutcome().notNull(),
    httpStatus: integer(),
    finalUrl: text(),
    contentHash: text(),
    markersFound: text().array().notNull().default(sql`'{}'::text[]`),
    markersMissing: text().array().notNull().default(sql`'{}'::text[]`),
    /** Short original summary or quote (≤ 500 chars). Full pages are never stored. */
    excerpt: text(),
    extracted: jsonb(),
    errorMessage: text(),
    durationMs: integer(),
  },
  (t) => [index().on(t.sourceId, t.observedAt), index().on(t.offerId, t.observedAt)],
);

export const verificationRecords = pgTable(
  "verification_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    couponId: uuid().references(() => coupons.id, { onDelete: "set null" }),
    state: verificationState().notNull(),
    method: verificationMethod().notNull(),
    countryCode: char({ length: 2 }),
    evidenceUrl: text(),
    note: text().notNull().default(""),
    observationId: uuid().references(() => sourceObservations.id, { onDelete: "set null" }),
    verifiedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    verifiedAt: tz().notNull(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.offerId, t.verifiedAt)],
);

export const offerRevisions = pgTable(
  "offer_revisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    changedAt: tz().notNull().defaultNow(),
    /** user | system | connector */
    actorType: text().notNull(),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorLabel: text().notNull().default(""),
    changeType: text().notNull(),
    changes: jsonb().notNull().default({}),
    note: text().notNull().default(""),
  },
  (t) => [index().on(t.offerId, t.changedAt)],
);

export const promotionalEvents = pgTable(
  "promotional_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    title: text().notNull(),
    kind: eventKind().notNull(),
    occasion: occasion().notNull().default("other"),
    startsOn: date({ mode: "string" }).notNull(),
    endsOn: date({ mode: "string" }),
    datesApproximate: boolean().notNull().default(false),
    sourceUrl: text().notNull(),
    evidenceNote: text().notNull().default(""),
    isPublished: boolean().notNull().default(false),
    isFixture: boolean().notNull().default(false),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index().on(t.startsOn), index().on(t.companyId)],
);

// ---------------------------------------------------------------------------
// Community input and review
// ---------------------------------------------------------------------------

export const userReports = pgTable(
  "user_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    offerId: uuid()
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    couponId: uuid().references(() => coupons.id, { onDelete: "set null" }),
    reason: reportReason().notNull(),
    details: text().notNull().default(""),
    countryCode: char({ length: 2 }),
    /** HMAC of coarse request attributes, rotated daily; not reversible to an IP. */
    fingerprint: text().notNull(),
    status: reportStatus().notNull().default("open"),
    resolutionNote: text(),
    resolvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    resolvedAt: tz(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.offerId, t.status)],
);

export const submissions = pgTable("submissions", {
  id: uuid().primaryKey().defaultRandom(),
  companyName: text().notNull(),
  productName: text(),
  offerUrl: text().notNull(),
  couponCode: text(),
  benefit: text().notNull(),
  countryRestrictions: text(),
  expiresOn: date({ mode: "string" }),
  evidence: text(),
  notes: text(),
  fingerprint: text().notNull(),
  status: submissionStatus().notNull().default("new"),
  linkedOfferId: uuid().references(() => offers.id, { onDelete: "set null" }),
  reviewNote: text(),
  reviewedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  reviewedAt: tz(),
  createdAt: tz().notNull().defaultNow(),
});

export const discoveryCandidates = pgTable(
  "discovery_candidates",
  {
    id: uuid().primaryKey().defaultRandom(),
    connectorKey: text().notNull(),
    sourceUrl: text().notNull(),
    externalId: text().notNull(),
    title: text().notNull(),
    summary: text().notNull().default(""),
    publishedAt: tz(),
    matchedKeywords: text().array().notNull().default(sql`'{}'::text[]`),
    companyId: uuid().references(() => companies.id, { onDelete: "set null" }),
    payload: jsonb(),
    status: candidateStatus().notNull().default("new"),
    linkedOfferId: uuid().references(() => offers.id, { onDelete: "set null" }),
    reviewedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    reviewedAt: tz(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.connectorKey, t.externalId)],
);

export const reviewItems = pgTable(
  "review_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: reviewKind().notNull(),
    status: reviewStatus().notNull().default("open"),
    /** 1 = high, 2 = normal, 3 = low */
    priority: integer().notNull().default(2),
    offerId: uuid().references(() => offers.id, { onDelete: "cascade" }),
    sourceId: uuid().references(() => sources.id, { onDelete: "set null" }),
    title: text().notNull(),
    details: text().notNull().default(""),
    payload: jsonb(),
    /** Prevents duplicate open items for the same underlying problem. */
    dedupeKey: text().notNull(),
    resolvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    resolvedAt: tz(),
    resolutionNote: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("review_items_open_dedupe").on(t.dedupeKey).where(sql`status = 'open'`),
    index().on(t.status, t.priority),
  ],
);

// ---------------------------------------------------------------------------
// Connectors and jobs
// ---------------------------------------------------------------------------

export const connectors = pgTable("connectors", {
  key: text().primaryKey(),
  name: text().notNull(),
  kind: connectorKind().notNull(),
  description: text().notNull().default(""),
  /** Why the platform may use this source (terms, robots, partner agreement). */
  permissionBasis: text().notNull(),
  permissionStatus: permissionStatus().notNull().default("pending"),
  retrievalMethod: text().notNull(),
  authRequired: boolean().notNull().default(false),
  config: jsonb().notNull().default({}),
  intervalMinutes: integer().notNull().default(1440),
  rateLimitPerMinute: integer().notNull().default(6),
  enabled: boolean().notNull().default(false),
  pausedReason: text(),
  lastRunAt: tz(),
  lastSuccessAt: tz(),
  consecutiveFailures: integer().notNull().default(0),
  lastError: text(),
  ...timestamps,
});

export const monitoringJobs = pgTable(
  "monitoring_jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: jobKind().notNull(),
    /** Offer id or connector key, depending on kind. */
    targetId: text(),
    uniqueKey: text().notNull().unique(),
    intervalMinutes: integer().notNull(),
    nextRunAt: tz().notNull(),
    enabled: boolean().notNull().default(true),
    lockedAt: tz(),
    lockedBy: text(),
    /** Consecutive failed attempts; reset on success. */
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(3),
    timeoutSeconds: integer().notNull().default(60),
    lastRunAt: tz(),
    lastSuccessAt: tz(),
    lastError: text(),
    ...timestamps,
  },
  (t) => [index().on(t.enabled, t.nextRunAt)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => monitoringJobs.id, { onDelete: "cascade" }),
    kind: jobKind().notNull(),
    targetId: text(),
    startedAt: tz().notNull(),
    finishedAt: tz(),
    status: runStatus().notNull(),
    attempt: integer().notNull().default(1),
    message: text().notNull().default(""),
    stats: jsonb(),
  },
  (t) => [index().on(t.jobId, t.startedAt), index().on(t.startedAt)],
);

// ---------------------------------------------------------------------------
// Content, audit, analytics
// ---------------------------------------------------------------------------

export const homepageSections = pgTable("homepage_sections", {
  key: text().primaryKey(),
  title: text().notNull(),
  description: text().notNull().default(""),
  isVisible: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  maxItems: integer().notNull().default(6),
  /** Hide the section when fewer real items exist. */
  minItems: integer().notNull().default(2),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorEmail: text().notNull().default(""),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt), index().on(t.entityType, t.entityId)],
);

/** Privacy-conscious analytics: no IPs, user agents or persistent visitor identifiers. */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: analyticsType().notNull(),
    offerId: uuid().references(() => offers.id, { onDelete: "set null" }),
    query: text(),
    resultCount: integer(),
    countryCode: char({ length: 2 }),
    path: text(),
    createdAt: tz().notNull().defaultNow(),
  },
  (t) => [index().on(t.type, t.createdAt), index().on(t.offerId, t.type)],
);
