# Implementation plan

Working product name: **Claimable** (placeholder; change in `src/lib/site.ts`). Source of product intent: `docs/PRODUCT_BRIEF.md`.

## Approach

Build one Next.js application backed by PostgreSQL. The pieces are a public discovery site, a secure admin dashboard, a Postgres-backed durable job queue, and a worker process that runs authorized source connectors. Business rules (eligibility, verification, pricing, ranking, dedupe, calendar predictions, redemption actions) live in pure, unit-tested functions under `src/server/domain`. Pages only render those decisions.

Delivery order:

1. **Foundation**: tooling, local Postgres, schema, docs, design tokens.
2. **Vertical slice**: an admin creates an offer and it persists. A visitor finds it via search and country filter, reads eligibility and renewal pricing, and follows the correct redemption action.
3. **Discovery breadth**: homepage sections, categories, student directory, coupon reveal/copy, company pages, mobile filters, SEO.
4. **Trust operations**: verification records, user reports, community submissions, review queue, audit log, analytics.
5. **Automated monitoring**: connectors, scheduled jobs, failure vs. expiry handling, stale detection, archival, dedupe merging.
6. **History and calendar**: observations, price history, revisions, company timelines, Deals Calendar.
7. **Launch content and hardening**: researched catalog, e2e flows, accessibility and responsive review, screenshots, security review.

Deferred (brief §31 and §36 phase 6): accounts for visitors, saved deals, follows, notifications, reputation, extensions, native apps, AI assistants, advanced prediction, checkout testing at scale, enterprise analytics, public API.

## Acceptance criteria

A phase is complete only when every criterion below is verified by an automated test or a recorded manual check (see `docs/PROGRESS.md`).

### Phase 1 — Foundation
- `bun install`, `bun run db:start`, `bun run db:migrate` succeed on a clean checkout; schema contains the entities in `docs/DATA_MODEL.md`.
- Publication status, availability, verification state and eligibility are separate columns or derived values; no single "verified" flag exists.
- `bun run typecheck` and `bun run test:unit` pass.

### Phase 2 — Vertical slice
- An unauthenticated request to any admin page or admin server action is rejected server-side; an editor can create offers; only admins manage users and connectors.
- An admin creates a company, product, plan, list-price observation and offer; the offer persists and an audit log entry is written.
- A draft offer is not publicly visible; a published one appears in `/deals` search (including a misspelled query) and respects the selected country: confirmed-ineligible offers are hidden unless "include restricted" is chosen; unknown eligibility is shown and labelled "Country eligibility not confirmed".
- The detail page shows currency, billing interval, promotional duration, renewal price/auto-renewal (or "Not disclosed"), restrictions, verification state with date, and the correct action label.
- Claim goes through `/go/<slug>`, which only redirects to the offer's approved merchant domains and records an outbound interaction (not a purchase).

### Phase 3 — Discovery breadth
- Homepage sections render only when they have enough real data; order and visibility come from the admin.
- Category, student, coupon, free-trial and lifetime pages are data-driven; one company can appear in several categories.
- Coupon offers use **Reveal Code**: the code is shown without an account, copy gives visible feedback, copy failure shows a manual fallback, and a merchant link is present. Works without JavaScript via a server-rendered reveal.
- Student offers show requirements, verification provider and restrictions before the action; the action label is accurate ("Verify student eligibility", "Claim student offer", "View student discount").
- Mobile: filter drawer with Apply, removable chips, Clear all; filters survive navigating to an offer and back.
- Sitemap, canonical URLs, metadata and breadcrumb JSON-LD exist; the platform is never marked as the seller.

### Phase 4 — Trust operations
- Visitors can report a problem and submit a deal; both enter review, are rate-limited, and never change offer status by themselves.
- Admins can record verification evidence (method, state, date, country, evidence URL); public pages show history.
- Every admin mutation writes an audit log entry.
- Analytics records searches (including zero-result searches), offer views, reveals, copies and claims without IP addresses or cross-site identifiers.

### Phase 5 — Automated monitoring
- Connectors have permission metadata, schedule, rate limit, enabled/paused state, failure counters and last-successful-check timestamps visible to admins.
- A timeout or 5xx records a failure and retries with backoff; it never marks an offer expired. Repeated failures (≥3) open a review item.
- A 404/410 or missing expected terms opens a review item; it does not auto-expire.
- An offer whose **confirmed** end date has passed becomes `expired` automatically and is archived after the grace period, keeping its history; unconfirmed end dates are flagged for review instead.
- Verification becomes "stale" when evidence is older than the risk-tier window.
- Equivalent feed items merge into the canonical offer while keeping each source and observation; offers with different eligibility or redemption paths stay separate.
- Jobs are durable (Postgres), survive restarts, can be triggered by the worker or by `/api/cron/tick` with a secret, and expose run history.

### Phase 6 — History and calendar
- Offer pages show a change timeline and the observation period, with tracking gaps stated; no "all-time low" claims.
- The calendar shows confirmed, historical and predicted events with distinct visual treatment and text labels; predictions require at least two evidence-backed occurrences in different years and are otherwise withheld with an explanation.
- Calendar can be filtered by company and category; company pages show a promotion timeline.

### Phase 7 — Launch content and hardening
- 30–50 researched offers are seeded with source URLs, observation timestamps, verification method and stated limitations, or fewer with the shortfall documented. No invented codes, prices, dates or eligibility.
- Fixtures are fictional, flagged `is_fixture`, excluded from public queries unless `SHOW_FIXTURES=1`, and refused when `NODE_ENV=production`.
- E2E: search → detail → claim; reveal → copy; mobile filters with back navigation; student restriction visibility; renewal cost visibility; keyboard-only flow; reduced-motion static fallbacks.
- Desktop and mobile screenshots reviewed against the adapted design; issues fixed or listed.
- `bun run build` succeeds.
