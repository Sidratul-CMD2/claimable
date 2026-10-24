# Architecture

## Decisions

| Concern | Choice | Why | Revisit when |
| --- | --- | --- | --- |
| Web framework | Next.js 16.4.2 (App Router, Turbopack), React 19.3, TypeScript 5.9 | Brief's suggested stack; server rendering for SEO; Server Actions for admin mutations. 16.4.0 was replaced because of published advisories (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r). | — |
| Runtime / tooling | Bun 1.4.4 for install, scripts, tests (`bun test`) and the local dev server | Only JS runtime on the build machine. Application code avoids `Bun.*` APIs so production can run on Node 20.9+. | CI/hosting standardises on Node |
| Database | PostgreSQL 18 (local: `embedded-postgres` binaries on port 5433; production: any managed Postgres via `DATABASE_URL`) | Real Postgres semantics, `pg_trgm` and `unaccent` for typo-tolerant search, durable job queue with `FOR UPDATE SKIP LOCKED`. No Docker required locally. | — |
| ORM / migrations | Drizzle ORM 0.45 + drizzle-kit, `postgres` (postgres.js) driver | Typed SQL close to the metal; generated SQL migrations committed in `drizzle/`. `postgres` is bundled (not external) because Turbopack's hashed externals do not resolve under Bun. | — |
| Styling | Tailwind CSS 4.3 + CSS custom-property tokens | Brief stack. shadcn/ui is not installed: the reference components are custom, and the few primitives needed (dialog/drawer via native `<dialog>`, buttons, inputs) are small. | Many more generic primitives are needed |
| Auth | First-party staff auth: scrypt password hashes, random session tokens stored hashed in Postgres, HttpOnly SameSite=Lax cookies, roles `admin`/`editor` | Only staff sign in during the MVP (visitor accounts are deferred), and no managed-provider credentials were available. Every server action re-checks the role. | Visitor accounts (phase 6) — move to a managed provider (e.g. Auth.js, Clerk) |
| Jobs / scheduling | Postgres-backed durable queue (`monitoring_jobs`, `job_runs`) + `bun run worker` loop; `/api/cron/tick` (bearer secret) runs due jobs for serverless hosts | No extra infrastructure; job state is visible in the admin; per-job timeouts and backoff. | Throughput needs a dedicated queue |
| Search | Postgres: `ILIKE` + trigram `word_similarity` + full-text over a maintained `search_text` column; ranking and eligibility in TypeScript domain code | Catalog is small (tens to low thousands). Keeps eligibility logic in one tested place. | > ~5k published offers: push eligibility filtering into SQL or add a search service |
| Browser tests | `playwright-core` driving the installed Google Chrome from `bun test` | No bundled browser download needed. | CI without Chrome: install a Playwright browser |

## Boundaries

```
src/
  app/                  Routes. Public pages, admin pages, route handlers (api/*, go/*).
  components/           Presentation only. effects/ (Orb, WarpText, GooeyNav, BranchedMenu, JellyRadio),
                        offers/, filters/, layout/, admin/, ui/.
  lib/                  Shared, side-effect-free helpers safe for client and server
                        (formatting, countries, filter param codec, labels, site config).
  server/
    db/                 Drizzle schema, client, migration runner. The only place SQL connections are created.
    domain/             Pure business rules: eligibility, verification, pricing, ranking, dedupe,
                        redemption, calendar prediction, monitoring policy, URL safety. No I/O. Unit tested.
    services/           Use cases combining DB access + domain rules (public queries, admin mutations,
                        reports, submissions, history, calendar, analytics, homepage).
    connectors/         Source connectors behind one interface + a polite HTTP client (robots.txt,
                        per-host rate limit, timeouts, size/content-type limits, no script execution).
    jobs/               Queue (claim/complete/fail/backoff), handlers, recurring schedule, runner.
    auth/               Password hashing, sessions, role guards.
    security/           Rate limiting, anonymised fingerprints.
scripts/                dev orchestration, db start/migrate/seed, worker, admin creation, screenshots.
data/catalog/           Researched launch offers with evidence (published data).
data/fixtures/          Fictional development/test fixtures (never published in production).
tests/unit|integration|e2e
```

Rules:

- Components never decide verification, eligibility, savings or action labels; they receive decision objects from `server/domain` via services.
- Only `server/services` and `server/jobs` touch the database; route handlers and server actions call services.
- Connectors return normalized observations/candidates; they do not write offer status. The ingestion service validates, deduplicates and routes to review.
- Admin mutations: server action → `requireRole()` → zod validation → service → audit log → `revalidatePath`.
- Outbound links always go through `/go/<slug>`, which checks the destination against the company's approved domains.

## Request flows

**Discovery**: `/deals?q&country&...` → `parseFilters()` (lib) → `searchOffers()` (service: SQL candidate fetch over published, non-fixture offers) → `evaluateCountryEligibility()` + `rankOffers()` (domain) → cards render decisions.

**Claim**: card/detail → `/go/<slug>` → `resolveRedirect()` (domain URL safety) → analytics `claim` event → 302 to merchant.

**Reveal**: button → `POST /api/offers/<slug>/reveal` → coupon list with status → analytics `reveal` → client copy with feedback. No-JS fallback: `?reveal=1` server-renders codes.

**Monitoring**: worker tick → `claimDueJobs()` (`SKIP LOCKED`) → handler (`offer.check` → official page monitor connector → observation) → `applyCheckResult()` (domain: success / changed / markers missing / not found / failure) → offer timestamps, review items, job backoff.

## Environments

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection. Local default `postgres://postgres:postgres@127.0.0.1:5433/claimable`. |
| `TEST_DATABASE_URL` | Integration/e2e database (default `.../claimable_test`). |
| `SESSION_SECRET` | 32+ random bytes; HMAC key for anonymised fingerprints. Required in production. |
| `CRON_SECRET` | Bearer token for `/api/cron/tick`. |
| `SITE_URL` | Canonical origin for metadata/sitemap. |
| `SHOW_FIXTURES` | `1` to include fixture offers (development/test only; ignored in production). |
| `CONNECTOR_USER_AGENT` | Override the bot user agent string. |
| `PARTNER_FEED_URL`, `PARTNER_FEED_TOKEN` | Optional authorized partner feed (JSON) connector. |

## Production deployment (not performed)

Any Node 20.9+ host that runs both `next start` and a long-lived `bun run worker` (or Node equivalent) process, with managed Postgres (backups enabled). On serverless hosts, schedule `GET /api/cron/tick` every 5–15 minutes with `Authorization: Bearer $CRON_SECRET` instead of running the worker.
