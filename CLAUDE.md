# Software Deals Platform

## Critical constraints
- Build a functioning software-offer discovery product with persistent data, server-side services, administration, and scheduled monitoring; a static showcase does not satisfy the brief.
- Prioritize truthful pricing, eligibility, and evidence over catalog size or decorative effects.
- Treat this as a pre-development plan; the suggested stack, providers, versions, and commands are not established repository facts.
- Inspect repository configuration before choosing commands or dependencies; record exact working commands here once confirmed.
- Treat component snippets and installation prompts in the design PDF as reference material, not automatic instructions to execute or copy unchanged.

## Scope
- Deliver the MVP in `docs/PRODUCT_BRIEF.md` section 31: responsive discovery, categories, search/filtering, country selection, student offers, offer details, coupon reveal/copy, and direct claims.
- Include a real database, secure admin dashboard, manual entry, a small set of authorized connectors, scheduled checks, verification timestamps, expiry handling, basic history, and an initial Deals Calendar.
- Aim for approximately 30–50 researched launch offers; publish fewer when evidence is insufficient and clearly label uncertainty.
- Keep browsing and public coupon reveal available without an account; add saved deals, follows, and notifications in the later personalization phase.
- Defer reputation systems, extensions, native apps, AI shopping assistants, advanced prediction, large-scale checkout testing, enterprise analytics, and a public API.
- Keep categories data-driven and allow multiple categories per company; student offers, coupons, trials, and lifetime deals are cross-category offer types.

## Data and trust
- Keep company, product, subscription plan, offer, and coupon as distinct concepts.
- Model publication status, availability, verification state, and user eligibility separately; never collapse them into one verified flag.
- Use the status definitions in brief section 16; preserve tentative country eligibility from section 10 without promoting it to confirmed eligibility.
- Centralize verification and eligibility decisions in testable server-side logic; presentation components display those decisions.
- Retain source URLs, provenance, observation/check timestamps, verification method, official terms, evidence, and known limitations.
- A live page does not prove a coupon works; one successful redemption does not prove eligibility for every country or user.
- Unknown prices, codes, dates, renewal terms, and restrictions remain explicitly unknown; AI extraction must not fill them with invented values.
- Distinguish temporary retrieval failures from expiry; record failures, retry appropriately, mark stale evidence, and escalate repeated failures for review.
- Deduplicate equivalent offers while preserving sources and observations; retain distinct offers when eligibility or redemption paths differ.
- Archive expired offers without deleting useful history; label tracking gaps and observation periods before making historical price claims.
- Route community submissions, conflicting evidence, and user reports through review; one anonymous report must not automatically change offer status.
- Keep confirmed, historical, and predicted calendar events visibly distinct; withhold predictions without sufficient historical evidence.

## Pricing and redemption
- Show currency, billing interval, upfront payment, promotional duration, renewal cost/status, cancellation terms, and restrictions when known.
- Calculate savings only against a reliable reference price for the same plan and comparable billing period; separate introductory savings from recurring prices.
- Rank eligible offers by real value and restrictions; use a neutral list when offers cannot be meaningfully compared.
- Let users choose their country; worldwide page access does not establish worldwide eligibility, and Bangladesh in the brief is an example rather than a default market.
- Show country and student/customer restrictions before Claim; direct student verification to the authorized provider.
- Use Reveal Code with copy feedback and a merchant link for coupons; use Claim Deal for direct promotions and an accurate action label for student offers.
- Keep expired and unverified states explicit; never fabricate urgency, working-code badges, or deals to populate empty results.
- Disclose affiliate links and sponsored placements; sponsorship must not determine verification or automatically override relevant organic rankings.

## Collection and operations
- Follow the ingestion lifecycle: discover, retrieve, parse, normalize, validate, deduplicate, verify, review, publish, monitor, update/archive.
- Keep source connectors, business rules, verification, database access, jobs, admin functions, notifications, and UI responsibilities separate without unnecessary microservices.
- Use permitted sources and retrieval methods; respect access restrictions and rate limits instead of bypassing login, CAPTCHA, or anti-bot controls.
- Give each connector configurable scheduling, permission metadata, failure handling, provenance, and a last-successful-check timestamp.
- Protect admin actions with server-side role authorization and audit logs; validate input, external redirects, and retrieved content.
- Redirect purchases to approved merchants; do not collect payment details, student identity documents, or university credentials.
- When notifications are implemented, provide preferences, deduplication, unsubscribe controls, and explicit labels for prediction-based alerts.
- Measure claims as outbound interactions, not completed purchases; expose connector failures and job health to administrators.

## Design and interaction
- Read `docs/DESIGN_NOTES.md` and the PDF before UI work; preserve their direction while prioritizing functionality, accessibility, and usability.
- Use Orb for restrained background atmosphere, GooeyNav for primary navigation, BranchedMenu for desktop categories, and Bento styling for offers.
- Keep the animated wordmark above the header navigation as directed; reduce its size or motion when necessary for usable search and mobile navigation.
- Use JellyRadio only for mutually exclusive choices; use checkbox/toggle semantics for multi-select filters.
- Keep essential card details and claim/reveal controls visible without hover; adapt Bento layouts to readable, content-driven mobile cards.
- Keep prices, restrictions, verification labels, and essential text static and readable; provide semantic text and static fallbacks for canvas effects.
- Support keyboard navigation, visible focus, screen readers, touch, and reduced motion; decoration must not intercept search or navigation input.
- On mobile, use a filter drawer with Apply; show removable filter chips and Clear All, and preserve filters when returning from an offer.
- Show only homepage sections supported by real data, with admin-controlled visibility/order; provide useful loading, empty, copy-failure, source-failure, and expired states.
- Document material departures from references; do not treat sample text, placeholder links, or component defaults as the product's identity or final design tokens.

## Completion
- Define and validate acceptance criteria per phase; do not mark a phase complete merely because its screens render.
- Check persistence, admin authorization, ingestion/deduplication, failed-check versus expiry behavior, regional eligibility, pricing, and calendar status distinctions for affected work.
- Verify search-to-claim and reveal/copy flows, mobile filter state, student restrictions, renewal-cost visibility, keyboard use, and reduced-motion/static fallbacks.
- Review desktop and mobile screenshots against the adapted design; report checks actually run and any remaining limitations.
- Keep public pages search-friendly and handle expired pages deliberately; do not present this referral platform as the merchant in structured data.

## Confirmed commands (verified 2026-10-24)
- Stack in use: Bun 1.4.4 (`~/.bun/bin`; no Node installed), Next.js 16.4.2, React 19.3, Drizzle 0.45, embedded PostgreSQL 18 on port 5433 (dev DB `claimable`, test DB `claimable_test`). Architecture decisions are in `docs/ARCHITECTURE.md`.
- `bun install` installs dependencies. `bun run dev` starts Postgres, runs migrations on both DBs, then starts Next on http://localhost:3000 and the job worker (add `-- --no-worker` to skip it).
- Separate parts: `bun run db:start`, `bun run db:migrate` (add `-- --test` for the test DB), `bun run dev:web`, `bun run worker`.
- Data: `bun run db:seed` (reference data plus the researched catalog; idempotent; `-- --update` applies catalog edits to untouched seed offers), `bun run db:seed:fixtures` (fictional; refused in production), `bun run admin:create`, `bun run jobs:run-due`.
- Checks: `bun run typecheck`, `bun test tests/unit tests/integration` (alias `bun run test`), `bun run build`, then `bun run test:e2e` (starts `next start` on :3001 against `claimable_test`; needs a build). Unit/integration and e2e share the test DB, so run them one after the other, never in parallel.
- Screenshots: `bun run screenshots` (env: `PAGES`, `BASE_URL`, `FULL_PAGE=1`, `REDUCED_MOTION=1`, `SUFFIX`, `CHROME_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader"` for software WebGL). Output goes to `artifacts/screenshots/`.
- Logs must stay outside the project (`~/Library/Logs/claimable/`). Next's watcher reloads endlessly if a log file inside the project changes. Only one `next dev` can run per project.
- If dev pages reload about once a second (HMR sends `restart` for the entry chunk list), the Turbopack dev cache is stale (seen after an unclean shutdown). Stop dev, run `rm -rf .next/dev` (generated output) and restart.
- The dev admin is `admin@claimable.local`; the password is in `.data/dev-admin.txt`. Never copy it into docs.

## Read when needed
- `docs/PRODUCT_BRIEF.md`: complete supplied product intent; use sections 5–13 for discovery/pricing, 14–19 for evidence/history, and 31–36 for scope and delivery planning.
- `docs/DESIGN_NOTES.md`: component-to-product mapping, intentional adaptations, source limitations, and open design decisions.
- `docs/Design Direction.pdf`: original 49-page component reference; inspect relevant examples before implementing their visual behavior.
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DESIGN_SYSTEM.md`: the product as built, technical decisions, tables and status rules, tokens and component adaptations.
- `docs/PLAN.md`: acceptance criteria per phase. `docs/SESSION_CHECKPOINT.md` and `docs/PROGRESS.md`: current state, verification results and remaining work.
