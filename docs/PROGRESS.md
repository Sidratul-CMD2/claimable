# Progress

**As of:** 2026-10-24 (resumed session, end). Session-by-session detail, including how each bug was diagnosed, is in `docs/SESSION_CHECKPOINT.md`.
**Working product name:** Claimable (placeholder, `src/lib/site.ts`).
**Repository:** `git init`-ed with **no commits**; everything is in the working tree. Nothing has been reset or discarded.

## 1. Run it

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run dev          # embedded Postgres (reused if running) + migrations + http://localhost:3000 + job worker
curl -s localhost:3000/api/health
```

- **Logs** go to `~/Library/Logs/claimable/` (`dev`, `db`, `web`, `worker`). Never write logs inside the project: Next's watcher would reload endlessly.
- **If pages reload about once a second**, the Turbopack dev cache is stale. Stop dev, run `rm -rf .next/dev` and restart.
- **Staff login:** `admin@claimable.local`. The password is in `.data/dev-admin.txt` (mode 600, gitignored) and is never copied into docs.
- **Dev DB `claimable`:** 32 published researched offers from 24 companies, reference data, 1 admin, monitoring jobs and live observations. The review queue is empty.
- **Test DB `claimable_test`:** reset by the integration and e2e suites on every run.
- **All confirmed commands** are listed in `CLAUDE.md` → "Confirmed commands".

## 2. Verified

| Area | Evidence |
| --- | --- |
| Domain rules: eligibility, staleness, pricing and savings, redemption labels, URL safety, dedupe, monitoring policy, lifecycle, ranking, calendar predictions | 72 unit tests |
| Vertical slice through the services, trust rules, monitoring and connectors against a local fixture server | 37 integration tests (109 total with the unit tests) |
| Browser flows against a production build | **26 e2e tests** (`tests/e2e/flows.test.ts`): admin login, company → offer form → source → verification → publish; coupon add, category visibility, homepage sections, connector config with the permission guard, staff user creation; search, country choice, restricted hiding; detail renewal and restrictions before Claim; Claim → approved merchant and outbound event; report → review → close; Reveal → Copy, copy failure, no-JS reveal; mobile drawer Apply, chips, back navigation, Clear all; keyboard and skip link; reduced-motion fallbacks; expired page; calendar entry and labelled prediction; editor restrictions; branded 404; no page errors; unique IDs on 12 admin pages |
| Live monitoring | Checks against all 32 official pages. 31 pass; Akamai answers bots with 403, so it's recorded as blocked (not bypassed) and re-verified manually. Two connector bugs found live were fixed with regression tests. |
| Visual review | Two consecutive full SwiftShader screenshot passes (15 pages × 2 viewports, 30/30) plus a reduced-motion pass (30/30): no console errors, no horizontal overflow. Detail pages, students, companies, calendar, lifetime and homepage reviewed by eye. |
| Production build | `bun run build` succeeds (38 routes) |

Bugs found by these checks and fixed this session:
- duplicate element IDs on admin pages
- a misleading eligibility verdict label
- condition text in the claim panel
- repeated "Source added" history entries
- the default 404
- the header search not prefilling `q`
- an `Intl` hydration risk
- the Orb grey square
- mobile overflow
- two dev reload loops: one caused by logs inside the project, one by a stale dev cache

## 3. Implemented, not yet exercised end to end

- **`/api/cron/tick` with a real `CRON_SECRET`:** only the 401 path has been checked.
- **RSS discovery against real feeds:** no feeds are configured yet. **The partner feed** needs credentials.

## 4. Remaining work

1. **Content (optional):** official coupon pages, historical promotions with sources for the calendar, the Microsoft 365 college offer, RSS feed URLs.
2. **Docs (optional):** `SOURCES.md` and `VERIFICATION.md`. Their content is mostly in `DATA_MODEL.md` and `/methodology`.
3. **Deployment (owner decisions):** host, managed Postgres, `SESSION_SECRET` and `CRON_SECRET`, `SITE_URL`, product name. Run `next start` plus `bun run worker`, or use the cron endpoint.
4. **Next phase (deferred by the brief):** visitor accounts, saved deals, follows, notifications.

## 5. Known issues and decisions

- **Geo-dependent prices:** Google AI (served for Bangladesh) and Adobe (served for Colombia). Automated checks can't see them, so they need editorial re-verification when stale.
- **Prices loaded by JavaScript** (Raycast, Parallels, Affinity terms) are recorded as unknown, and those checks confirm the expected phrase or reachability only.
- Filter GET URLs carry empty parameters (harmless).
- Embedded Postgres runs under Rosetta.
- `next dev` regenerates `AGENTS.md` (harmless).
- **Open owner decisions:** product name, partner or affiliate credentials, hosting, the auth provider for future visitor accounts.

## 6. Estimated MVP completion

| Area | Weight | Est. |
| --- | ---: | ---: |
| UI and responsive design | 14% | 85% |
| Search, filters, country eligibility | 12% | 90% |
| Offer details, coupon/claim | 12% | 88% |
| Database and backend | 14% | 90% |
| Admin dashboard | 12% | 93% |
| Connectors and monitoring | 12% | 84% |
| Verification, expiry, history | 10% | 90% |
| Deals Calendar | 6% | 70% |
| Testing and production readiness (incl. launch content) | 8% | 78% |

**Overall ≈ 87% (estimate; weighted sum 86.5).** The basis for each row is in `docs/SESSION_CHECKPOINT.md` section 8.
