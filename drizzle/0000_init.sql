CREATE TYPE "public"."analytics_type" AS ENUM('search', 'offer_view', 'reveal', 'copy', 'claim', 'report', 'submission');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('active', 'expired', 'paused', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('day', 'week', 'month', 'year', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('new', 'promoted', 'dismissed', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."connector_kind" AS ENUM('monitor', 'discovery', 'feed');--> statement-breakpoint
CREATE TYPE "public"."country_status" AS ENUM('confirmed_eligible', 'confirmed_ineligible', 'likely_eligible', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."coupon_status" AS ENUM('unverified', 'officially_published', 'redemption_tested', 'expired', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."customer_eligibility" AS ENUM('all', 'new_customers', 'existing_customers', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('confirmed', 'historical');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('offer_check', 'connector_run', 'expire_offers', 'archive_expired', 'stale_scan');--> statement-breakpoint
CREATE TYPE "public"."observation_outcome" AS ENUM('ok', 'changed', 'markers_missing', 'not_found', 'redirected', 'blocked', 'robots_disallowed', 'error', 'timeout', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."occasion" AS ENUM('black_friday', 'cyber_monday', 'back_to_school', 'new_year', 'anniversary', 'seasonal', 'product_launch', 'student_period', 'holiday', 'other');--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('coupon', 'direct', 'student', 'free_trial', 'lifetime', 'promo_credit');--> statement-breakpoint
CREATE TYPE "public"."permission_status" AS ENUM('approved', 'pending', 'not_configured', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."price_kind" AS ENUM('list', 'promotional', 'renewal');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'pending_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('code_not_working', 'promotion_expired', 'wrong_discount', 'country_unavailable', 'student_verification_failed', 'broken_link', 'incorrect_renewal_info', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved_valid', 'resolved_invalid', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."review_kind" AS ENUM('repeated_failures', 'page_not_found', 'markers_missing', 'redirect_changed', 'blocked_source', 'robots_disallowed', 'unconfirmed_end_date_passed', 'stale_verification', 'conflicting_sources', 'user_reports', 'submission', 'discovery_candidate', 'duplicate_candidate');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('high', 'standard', 'evergreen');--> statement-breakpoint
CREATE TYPE "public"."rule_scope" AS ENUM('global', 'region', 'country');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('success', 'failure', 'timeout', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('official_promo_page', 'official_pricing_page', 'official_student_page', 'official_announcement', 'official_terms', 'official_feed', 'partner_feed', 'affiliate_program', 'newsletter', 'community_submission', 'marketplace_listing', 'editorial', 'third_party_signal');--> statement-breakpoint
CREATE TYPE "public"."student_action" AS ENUM('claim', 'verify', 'view');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('new', 'accepted', 'rejected', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."tri_state" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('editorial_official_page_review', 'automated_official_page_check', 'manual_redemption_test', 'partner_feed', 'user_report_review', 'admin_correction');--> statement-breakpoint
CREATE TYPE "public"."verification_state" AS ENUM('officially_confirmed', 'redemption_tested', 'evidence_supported', 'unverified');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "analytics_type" NOT NULL,
	"offer_id" uuid,
	"query" text,
	"result_count" integer,
	"country_code" char(2),
	"path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"website_url" text NOT NULL,
	"allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"logo_url" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_categories" (
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "company_categories_company_id_category_id_pk" PRIMARY KEY("company_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "connector_kind" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permission_basis" text NOT NULL,
	"permission_status" "permission_status" DEFAULT 'pending' NOT NULL,
	"retrieval_method" text NOT NULL,
	"auth_required" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interval_minutes" integer DEFAULT 1440 NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 6 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"paused_reason" text,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "coupon_status" DEFAULT 'unverified' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_url" text,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_tested_at" timestamp with time zone,
	"test_country" char(2),
	"test_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_key" text NOT NULL,
	"source_url" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"matched_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"company_id" uuid,
	"payload" jsonb,
	"status" "candidate_status" DEFAULT 'new' NOT NULL,
	"linked_offer_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_sections" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"max_items" integer DEFAULT 6 NOT NULL,
	"min_items" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" "job_kind" NOT NULL,
	"target_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "run_status" NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "monitoring_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "job_kind" NOT NULL,
	"target_id" text,
	"unique_key" text NOT NULL,
	"interval_minutes" integer NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"timeout_seconds" integer DEFAULT 60 NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitoring_jobs_uniqueKey_unique" UNIQUE("unique_key")
);
--> statement-breakpoint
CREATE TABLE "offer_categories" (
	"offer_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "offer_categories_offer_id_category_id_pk" PRIMARY KEY("offer_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "offer_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_country_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"scope" "rule_scope" NOT NULL,
	"country_code" char(2),
	"region_code" text,
	"status" "country_status" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_country_rules_offerId_scope_countryCode_regionCode_unique" UNIQUE NULLS NOT DISTINCT("offer_id","scope","country_code","region_code")
);
--> statement-breakpoint
CREATE TABLE "offer_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text DEFAULT '' NOT NULL,
	"change_type" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_sources" (
	"offer_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"role" text DEFAULT 'supporting' NOT NULL,
	"expected_markers" text[] DEFAULT '{}'::text[] NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_sources_offer_id_source_id_pk" PRIMARY KEY("offer_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid,
	"plan_id" uuid,
	"title" text NOT NULL,
	"benefit" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"offer_type" "offer_type" NOT NULL,
	"publication_status" "publication_status" DEFAULT 'draft' NOT NULL,
	"availability" "availability" DEFAULT 'unknown' NOT NULL,
	"verification_state" "verification_state" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"risk_tier" "risk_tier" DEFAULT 'standard' NOT NULL,
	"customer_eligibility" "customer_eligibility" DEFAULT 'unknown' NOT NULL,
	"student_required" boolean DEFAULT false NOT NULL,
	"student_action" "student_action",
	"student_verification_provider" text,
	"student_email_required" "tri_state" DEFAULT 'unknown' NOT NULL,
	"student_requirements" text,
	"institution_types" text,
	"max_eligible_duration" text,
	"verification_renewal" text,
	"default_country_status" "country_status" DEFAULT 'unknown' NOT NULL,
	"currency" char(3),
	"promo_price_minor" integer,
	"promo_interval" "billing_interval",
	"promo_duration_months" integer,
	"upfront_payment_minor" integer,
	"renewal_price_minor" integer,
	"renewal_interval" "billing_interval",
	"auto_renews" "tri_state" DEFAULT 'unknown' NOT NULL,
	"cancellation_terms" text,
	"tax_note" text,
	"payment_method_note" text,
	"applies_to_existing_accounts" "tri_state" DEFAULT 'unknown' NOT NULL,
	"advertised_discount_percent" integer,
	"trial_days" integer,
	"credit_amount_minor" integer,
	"credit_validity" text,
	"lifetime_terms" text,
	"redemption_url" text NOT NULL,
	"is_affiliate" boolean DEFAULT false NOT NULL,
	"affiliate_disclosure" text,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"ends_at_confirmed" boolean DEFAULT false NOT NULL,
	"official_terms_url" text,
	"terms_summary" text,
	"known_limitations" text,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"monitor_interval_hours" integer,
	"dedupe_key" text NOT NULL,
	"canonical_offer_id" uuid,
	"search_text" text DEFAULT '' NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"audience" text DEFAULT 'individual' NOT NULL,
	"official_pricing_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"offer_id" uuid,
	"kind" "price_kind" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"country_code" char(2),
	"observed_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"is_reliable" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" uuid,
	"connector_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"offer_id" uuid,
	"title" text NOT NULL,
	"kind" "event_kind" NOT NULL,
	"occasion" "occasion" DEFAULT 'other' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"dates_approximate" boolean DEFAULT false NOT NULL,
	"source_url" text NOT NULL,
	"evidence_note" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_group_countries" (
	"region_code" text NOT NULL,
	"country_code" char(2) NOT NULL,
	CONSTRAINT "region_group_countries_region_code_country_code_pk" PRIMARY KEY("region_code","country_code")
);
--> statement-breakpoint
CREATE TABLE "region_groups" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "review_kind" NOT NULL,
	"status" "review_status" DEFAULT 'open' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"offer_id" uuid,
	"source_id" uuid,
	"title" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"payload" jsonb,
	"dedupe_key" text NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"offer_id" uuid,
	"connector_key" text NOT NULL,
	"job_run_id" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "observation_outcome" NOT NULL,
	"http_status" integer,
	"final_url" text,
	"content_hash" text,
	"markers_found" text[] DEFAULT '{}'::text[] NOT NULL,
	"markers_missing" text[] DEFAULT '{}'::text[] NOT NULL,
	"excerpt" text,
	"extracted" jsonb,
	"error_message" text,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"publisher" text DEFAULT '' NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"connector_key" text,
	"first_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_outcome" "observation_outcome",
	"last_http_status" integer,
	"last_content_hash" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"product_name" text,
	"offer_url" text NOT NULL,
	"coupon_code" text,
	"benefit" text NOT NULL,
	"country_restrictions" text,
	"expires_on" date,
	"evidence" text,
	"notes" text,
	"fingerprint" text NOT NULL,
	"status" "submission_status" DEFAULT 'new' NOT NULL,
	"linked_offer_id" uuid,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"coupon_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"country_code" char(2),
	"fingerprint" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"last_login_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"coupon_id" uuid,
	"state" "verification_state" NOT NULL,
	"method" "verification_method" NOT NULL,
	"country_code" char(2),
	"evidence_url" text,
	"note" text DEFAULT '' NOT NULL,
	"observation_id" uuid,
	"verified_by" uuid,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_categories" ADD CONSTRAINT "company_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_categories" ADD CONSTRAINT "company_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_linked_offer_id_offers_id_fk" FOREIGN KEY ("linked_offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_job_id_monitoring_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."monitoring_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_categories" ADD CONSTRAINT "offer_categories_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_categories" ADD CONSTRAINT "offer_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_conditions" ADD CONSTRAINT "offer_conditions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_country_rules" ADD CONSTRAINT "offer_country_rules_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_country_rules" ADD CONSTRAINT "offer_country_rules_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_country_rules" ADD CONSTRAINT "offer_country_rules_region_code_region_groups_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."region_groups"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_revisions" ADD CONSTRAINT "offer_revisions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_revisions" ADD CONSTRAINT "offer_revisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_sources" ADD CONSTRAINT "offer_sources_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_sources" ADD CONSTRAINT "offer_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_events" ADD CONSTRAINT "promotional_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_events" ADD CONSTRAINT "promotional_events_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_events" ADD CONSTRAINT "promotional_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_group_countries" ADD CONSTRAINT "region_group_countries_region_code_region_groups_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."region_groups"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_group_countries" ADD CONSTRAINT "region_group_countries_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_observations" ADD CONSTRAINT "source_observations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_observations" ADD CONSTRAINT "source_observations_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_linked_offer_id_offers_id_fk" FOREIGN KEY ("linked_offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_observation_id_source_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."source_observations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_at_index" ON "analytics_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_offer_id_type_index" ON "analytics_events" USING btree ("offer_id","type");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_index" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_offer_id_code_index" ON "coupons" USING btree ("offer_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_candidates_connector_key_external_id_index" ON "discovery_candidates" USING btree ("connector_key","external_id");--> statement-breakpoint
CREATE INDEX "job_runs_job_id_started_at_index" ON "job_runs" USING btree ("job_id","started_at");--> statement-breakpoint
CREATE INDEX "job_runs_started_at_index" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "monitoring_jobs_enabled_next_run_at_index" ON "monitoring_jobs" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "offer_conditions_offer_id_index" ON "offer_conditions" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_revisions_offer_id_changed_at_index" ON "offer_revisions" USING btree ("offer_id","changed_at");--> statement-breakpoint
CREATE INDEX "offers_publication_status_availability_index" ON "offers" USING btree ("publication_status","availability");--> statement-breakpoint
CREATE INDEX "offers_company_id_index" ON "offers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "offers_dedupe_key_index" ON "offers" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "offers_ends_at_index" ON "offers" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "offers_search_text_trgm" ON "offers" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "plans_product_id_slug_index" ON "plans" USING btree ("product_id","slug");--> statement-breakpoint
CREATE INDEX "price_points_plan_id_observed_at_index" ON "price_points" USING btree ("plan_id","observed_at");--> statement-breakpoint
CREATE INDEX "price_points_offer_id_observed_at_index" ON "price_points" USING btree ("offer_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_id_slug_index" ON "products" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "promotional_events_starts_on_index" ON "promotional_events" USING btree ("starts_on");--> statement-breakpoint
CREATE INDEX "promotional_events_company_id_index" ON "promotional_events" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_items_open_dedupe" ON "review_items" USING btree ("dedupe_key") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "review_items_status_priority_index" ON "review_items" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_observations_source_id_observed_at_index" ON "source_observations" USING btree ("source_id","observed_at");--> statement-breakpoint
CREATE INDEX "source_observations_offer_id_observed_at_index" ON "source_observations" USING btree ("offer_id","observed_at");--> statement-breakpoint
CREATE INDEX "user_reports_offer_id_status_index" ON "user_reports" USING btree ("offer_id","status");--> statement-breakpoint
CREATE INDEX "verification_records_offer_id_verified_at_index" ON "verification_records" USING btree ("offer_id","verified_at");