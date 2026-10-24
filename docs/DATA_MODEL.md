# Data model

Source of truth: `src/server/db/schema.ts` (Drizzle) and `src/lib/enums.ts` (enum values). Migrations live in `drizzle/`. This document explains how the tables fit together and which rules the data must obey.

## Principles

- **Company, product, plan, offer and coupon are separate records.** A company owns products, a product owns plans, and an offer belongs to a company (product and plan are optional). Coupons belong to an offer.
- **Status has four independent dimensions:** publication, availability, verification and eligibility. There is no single "verified" flag.
- **NULL means unknown.** Pricing, dates, renewal terms and student details are nullable, and the UI shows them as "Not disclosed". Tri-state fields (`yes` / `no` / `unknown`) are used where "no" and "unknown" differ.
- **History is append-only.** Prices, observations, verification records, revisions and audit entries are added and never edited. Expired offers are archived, not deleted.
- **Fixtures are flagged.** `is_fixture` on companies, offers and events keeps fictional development data out of public queries unless `SHOW_FIXTURES=1`, and never in production.

## Status dimensions on `offers`

| Dimension | Column | Values | Changed by |
| --- | --- | --- | --- |
| Publication | `publication_status` | `draft`, `pending_review`, `published`, `archived` | Staff only, through `setPublicationStatus`. Publishing is blocked until the checks in `publishProblems()` pass (below). Archiving also happens automatically 30 days after expiry. |
| Availability | `availability` | `active`, `expired`, `paused`, `unknown` | Staff with a note. The expiry job sets `expired` only from a **confirmed** end date (`ends_at_confirmed`). An unconfirmed date that has passed opens a review item. |
| Verification | `verification_state`, `verified_at` | `officially_confirmed`, `redemption_tested`, `evidence_supported`, `unverified` | Staff verification records. An automated check refreshes `verified_at` only when the offer is `officially_confirmed`, the source is official, expected terms are configured and every one of them was found. A reachability-only check never refreshes evidence. "Stale" is derived, not stored: evidence older than the risk-tier window (high 7 days, standard 30, evergreen 90). |
| Country eligibility | `offer_country_rules` + `default_country_status` | `confirmed_eligible`, `confirmed_ineligible`, `likely_eligible`, `unknown` | Staff. Resolution order: country rule → region rule → global rule → default. Conflicts resolve conservatively, and `likely_eligible` is never promoted to confirmed. |
| Visitor eligibility | derived (`evaluateUserEligibility`) | `eligible`, `ineligible`, `unknown`, `requires_verification` | Computed per request from country status, student requirement and customer eligibility. |

`publishProblems()` (`src/server/domain/lifecycle.ts`) requires:
- a title and a benefit
- an https redemption URL on one of the company's approved domains
- at least one source
- at least one code, for coupon offers
- written educational requirements, for student offers

An offer can be published while `unverified`, and the public page then says so.

## Tables

### Catalog

| Table | Purpose | Notes |
| --- | --- | --- |
| `categories` | Data-driven categories (slug, name, order, visibility) | Offer types such as student, coupon or trial are **not** categories. |
| `companies` | Merchant identity | `allowed_domains` limits where `/go/<slug>` may redirect. `logo_url` is set only when the mark may be displayed. |
| `company_categories` | Many-to-many | A company can sit in several categories. |
| `products` | A company's product | `platforms[]` |
| `plans` | A product's plan | Anchors list-price comparisons. |
| `price_points` | Append-only price observations | `kind`: `list` (plan), `promotional` and `renewal` (offer). Only `is_reliable` list prices for the same plan, currency and interval, observed within 120 days, may anchor savings. |

### Offers

| Table | Purpose | Notes |
| --- | --- | --- |
| `offers` | The promotion | Status dimensions (above), audience and student fields, pricing in minor units with intervals, `trial_days`, credit, `lifetime_terms`, redemption URL, affiliate and sponsored flags with disclosure, dates and `ends_at_confirmed`, terms summary, `known_limitations`, risk tier, `monitor_interval_hours`, `dedupe_key`, `canonical_offer_id`, `search_text` (trigram-indexed). |
| `offer_categories` | Many-to-many | |
| `offer_country_rules` | Per-offer eligibility rules | `scope`: `country`, `region` or `global`, each with a status, note and source URL. Unique per offer + scope + place. |
| `offer_conditions` | Restrictions shown before Claim | `kind` (see `CONDITION_KINDS`) plus a free-text description, which the UI prefers when present. |
| `coupons` | Codes for an offer | `status`: `unverified`, `officially_published`, `redemption_tested`, `expired`, `invalid`. `last_tested_at` and `test_country` record a redemption test in one named country, which doesn't prove the code works elsewhere. |

### Evidence and history

| Table | Purpose |
| --- | --- |
| `sources` | One row per URL: type (official promo, pricing, student or terms page, announcement, feed, partner, community…), `is_official`, last check, last success, last outcome, HTTP status, content hash, `consecutive_failures`. |
| `offer_sources` | Links offers to sources with a `role` (terms, pricing, student_terms, coupon, discovery, supporting) and `expected_markers[]`, the phrases whose disappearance opens review. |
| `source_observations` | Every automated check: outcome (`ok`, `changed`, `markers_missing`, `not_found`, `redirected`, `blocked`, `robots_disallowed`, `error`, `timeout`, `skipped`), markers found or missing, a short excerpt (full pages are never stored), duration. |
| `verification_records` | Who verified what, how (`editorial_official_page_review`, `automated_official_page_check`, `manual_redemption_test`, …), when, in which country, with evidence URL and note. Feeds the public verification history. |
| `offer_revisions` | Change log per offer (actor, change type, changed fields, note). Feeds the public history timeline. |
| `promotional_events` | Deals Calendar entries: `confirmed` (announced) or `historical` (observed), each with a required source URL and an approximate-dates flag. **Predicted** windows are computed at read time from at least two historical years and are never stored. |

### Community and review

| Table | Purpose |
| --- | --- |
| `user_reports` | Visitor problem reports (reason, optional coupon, country, details), keyed by an anonymised daily-rotating fingerprint. A single report never changes an offer. |
| `submissions` | Visitor deal submissions. A submitted code stays unverified until staff check it. |
| `discovery_candidates` | Items from discovery connectors (for example RSS keyword matches) awaiting review. |
| `review_items` | The staff queue. `kind` covers monitoring findings, stale verification, unconfirmed end dates, conflicting sources, reports, submissions, candidates and duplicates. `dedupe_key` keeps one open item per issue. Closing an item needs a note. |

### Operations

| Table | Purpose |
| --- | --- |
| `connectors` | Connector registry: kind, permission basis and status (`approved`, `pending`, `not_configured`, `revoked`), retrieval method, config (JSON), interval, rate limit, enabled or paused with reason, last run, last success, failures, last error. Only approved connectors can be enabled. |
| `monitoring_jobs` | Durable queue: kind (`offer_check`, `connector_run`, `expire_offers`, `archive_expired`, `stale_scan`), `unique_key`, interval, `next_run_at`, lock, attempts, timeout. Claimed with `FOR UPDATE SKIP LOCKED`. Failures back off at 5 / 20 / 80 minutes, capped at 6 hours. |
| `job_runs` | Run history per job (status, attempt, message, stats). |
| `homepage_sections` | Admin-controlled order, visibility, minimum and maximum items. A section with fewer real offers than its minimum is hidden. |
| `audit_logs` | Every admin mutation with before and after values. |
| `analytics_events` | `search` (with result count), `offer_view`, `reveal`, `copy`, `claim` (an outbound interaction, not a purchase), `report`, `submission`. No IP addresses or cross-site identifiers. |
| `users`, `sessions`, `rate_limits` | Staff accounts (scrypt hashes, `admin` and `editor` roles), hashed session tokens, fixed-window rate limits. |
| `countries`, `region_groups`, `region_group_countries` | Reference data for eligibility (ISO countries; EU, EEA and other groups). |

## Failure vs expiry

A check that times out, returns a 5xx or hits an error records a failure and backs off. It never changes availability. Three consecutive failures (`FAILURE_ESCALATION_THRESHOLD`) open a `repeated_failures` review item, and evidence that isn't refreshed eventually shows as stale. A 404/410, a changed redirect or missing expected terms opens review. Only a confirmed end date expires an offer automatically.

## Deduplication

`dedupe_key` is a signature (`dedupeSignature()`) made of:
- company, product and plan, and offer type
- coupon codes and the redemption destination
- discount terms: promotional price, currency and interval, advertised percentage, trial days, credit
- student requirement, customer eligibility and country rules
- start and end dates

An equivalent offer is flagged as a duplicate, and its sources should be attached to the existing offer. Offers whose eligibility or redemption path differs get different signatures and stay separate. Staff can override a flag by marking the offer "genuinely distinct".
