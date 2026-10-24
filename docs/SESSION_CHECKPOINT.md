# Session checkpoint — 2026-10-24 (evening, owner shutting down)

This file records **this session's** work and the exact resume point. `docs/PROGRESS.md` holds the earlier full checkpoint and assessment (sections 1–10); read it after this file.

Nothing is committed. The repo has no commits; all work is in the working tree. Nothing was reverted or discarded.

## 0. Resumed session (2026-10-24, later) — progress so far

- **Orb fix verified (section 3 is resolved).** With software WebGL (`CHROME_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader"`), the homepage shows the animated orb ring; without GPU, the static ring renders. No grey square in either case.
- **Full screenshot pass is clean:** 15 pages × 2 viewports, all ✓ (no HTTP errors, console errors or overflow), with motion and with `REDUCED_MOTION=1`.
- `scripts/screenshots.ts` gained `CHROME_ARGS` (extra Chrome flags) and `SUFFIX` (output-name suffix). It also now prints React's +/- diff lines for hydration warnings. One attribute-mismatch hydration warning appeared once under SwiftShader and didn't recur in 5 reruns; the diff capture will show the cause if it returns.
- **Fixed:** the claim panel on detail pages listed condition kinds ("New customers only") even when the condition had a more accurate description (Spotify: "new Premium subscribers"). It now prefers the condition's description (`src/app/(site)/deals/[slug]/page.tsx`).
- Detail pages reviewed in full-page screenshots: Spotify (desktop and mobile) and Adobe-CO. Adobe-CO shows 77% introductory savings against a reliable COP list price, a 12-month total, verification history with the automated check, and the history timeline. All render correctly.
- Static-text check: every monitoring marker for Azure (both offers), AWS, Setapp, Apple Music and Office 365 A1 is present in the pages' static HTML, so those checks aren't relying on JavaScript-rendered text.
- After a cold restart, an HMR reload loop showed up briefly and stopped once the server warmed up. No files were changing and it didn't recur.
- **Claim-panel wording:** the overall verdict badge said "Eligibility unknown" right under "Bangladesh · Likely eligible", which read as a contradiction. The user-eligibility labels now speak to the visitor: "Your eligibility: not confirmed", "Eligible for you", "Not eligible for you", "Needs verification to claim" (`src/lib/labels.ts`). The decision logic is unchanged.
- **Production build passes** (`bun run build`: 38 routes). `next build` and `next dev` can run side by side because dev output goes to `.next/dev`.
- **E2E suite written and passing: 20/20, twice in a row** (`tests/e2e/flows.test.ts`, `tests/e2e/server.ts`). `bun run test:e2e` starts `next start` on :3001 against `claimable_test` (it needs a build first). It uses system Chrome with SwiftShader. All data is fictional (`lumen.example`), and requests to the merchant domain are answered locally. Covered:
  - admin login (redirect when signed out, wrong password refused)
  - create a company → create a draft offer through the form (unknown fields stay NULL) → attach an official source → record verification → publish
  - visitor search → country choice (Canada confirmed; Bangladesh hidden as confirmed-unavailable, with "Show it") → detail shows renewal and restrictions before Claim → Claim opens the approved merchant and logs an outbound `claim` event with the country
  - visitor report → review item opened while the offer is unchanged → editor closes it with a note
  - Reveal Code → Copy (clipboard contents, "Copied" feedback, `reveal`/`copy` events); clipboard failure message; no-JavaScript fallback
  - mobile drawer: changes are staged until Apply, chips, filters survive visiting an offer and going back, Clear all, no overflow
  - keyboard: the skip link comes first, focus is visible, search works with Enter
  - reduced motion: decorative canvases present with motion, none with reduced motion
  - expired offer page: banner, no claim link, excluded from search
  - calendar: an editor enters sourced historical events; two years of history produce a "Predicted — not announced" window; unpublished events stay hidden
  - roles: an editor has no Users link, `/admin/users` redirects to `?denied=1`, and there's no "Run now" on jobs (an admin sees it)
  - no uncaught page errors, and unique element IDs on 12 admin pages
- **Accessibility bug found by the e2e suite and fixed: duplicate element IDs on admin pages.** On the offer edit page, categories, homepage sections, company plans and prices, connector forms, review queue and calendar, repeated forms reused IDs like `name`, `title`, `note` and `availability`, so labels pointed at the wrong control.
  - The field primitives in `src/components/admin/fields.tsx` gained a `scope` prop (id = `scope-name`) and `aria-label` for inputs without a visible label. Every repeated form now passes a scope.
  - The offer edit page's panel headings use `<id>-heading`.
  - Inputs that only had placeholders (categories, plans, prices, review notes) now have accessible names.
- **The 3 open review items in the dev DB were resolved through `/admin/review` in the browser.** First I confirmed that later checks were clean: Ableton's terms found, Affinity reachable, Apple's new page OK. Each resolution has a note explaining the cause and fix. The queue is now empty.
- **`scripts/dev.ts` written, so `bun run dev` works.** It starts or reuses embedded Postgres, waits for the port, migrates the dev and test DBs, then starts `next dev` and the worker (`-- --no-worker` skips it). Output is prefixed and appended to `~/Library/Logs/claimable/{dev,db,web,worker}.log`. SIGINT/SIGTERM stops the children, and the database is stopped only if this script started it. Verified: health 200, the worker ran `connector_run` and `expire_offers`, no reload loop. **The preview now runs through this orchestrator** (detached; see section 1).
- **Docs written:**
  - `docs/PRODUCT.md`: the product as built
  - `docs/DATA_MODEL.md`: tables, status dimensions, NULL semantics, publish rules, failure vs expiry, dedupe signature, all checked against the code
  - `docs/DESIGN_SYSTEM.md`: tokens, component adaptations, responsive and accessibility rules, departures from the references
  - `CLAUDE.md`: new "Confirmed commands" section and pointers to the new docs; the original rules are untouched
- **Small fixes, each covered by e2e:**
  - Unmatched URLs now return 404 with the site header and footer (`src/app/not-found.tsx` plus the shared `NotFoundContent`).
  - The header search shows the current `q` (`SearchBox` reads it from the URL).
  - `CountrySelector` receives server-computed country names (`countryLabel`, `suggestedLabel`), which removes the `Intl` hydration risk.
  - The hero Orb is smaller and dimmer below `md`, so it no longer spans the headline on phones.
- **Dev reload loop, second cause (diagnosed and recovered):**
  - The cause was a stale Turbopack dev cache in `.next/dev`. HMR sent `restart` for the entry chunk list (a file from 06:31) on every connect, so every page reloaded about once a second.
  - Recovery: stop dev, run `rm -rf .next/dev`, restart. That gave 0 restarts.
  - It couldn't be reproduced afterwards by `next build` while dev ran, by an e2e run, or by a clean dev restart. The likely origin is the earlier shutdown with the dev server running. Recorded in `CLAUDE.md`.
  - The only project file that changes per page view is Next's own `.next/dev/logs/next-development.log`, which is harmless with a healthy cache.
- **The intermittent hydration warning was a test artifact, now fixed.** Playwright's default `caret: "hide"` writes inline `caret-color` onto inputs before each screenshot. On the slow SwiftShader homepage, hydration sometimes hadn't finished, so React reported the extra attribute. `scripts/screenshots.ts` now passes `caret: "initial"`. Result: the homepage passed 3 runs in a row. Two consecutive full passes with SwiftShader were 30/30, and the reduced-motion pass was 30/30.
- **Research top-up: the catalog grew from 26 to 32 offers (24 companies), meeting the brief's 30–50 range.** The pages were fetched with the platform's own polite client (robots.txt honoured, static HTML only). Added:
  - GitHub Copilot Student (free)
  - Wolfram|Alpha Pro for Students ($60/yr)
  - Raycast Pro 50% off for students (prices JS-rendered, so unknown)
  - Craft Education plan (free)
  - DaisyDisk lifetime licence ($9.99 one-time; standard price, labelled as such)
  - Parallels Desktop Pro 50% off for students, educators and parents

  All six passed their first live check with expected terms found. Parallels 301-redirects to `/plans/education/`; the catalog moved to the canonical URL with `--update` and the review item was closed with a note. Excluded as too thin: Lucidchart, Codecademy; unusable: Bitwig (404), Todoist, Mural, Overleaf. Everything is in `docs/research/catalog-research-log.md` (batch 7).
- **History bug found and fixed: re-attaching an unchanged source wrote a new "Source added" revision.** Every `db:seed -- --update` run did this, so public timelines showed "Source added" up to 4 times.
  - `attachSource` now does nothing for an unchanged link and writes `source_updated` (labelled "Source details updated") when the role or expected terms change. Regression test added (109 tests).
  - The 82 spurious rows in the dev DB were deleted. They were exact repeats of an already-attached URL with no removal in between, all created by today's seed runs. A fresh `--update` now writes nothing.
- The renewal row in the pricing table shows the standard "Not disclosed" instead of repeating "Renewal price not disclosed."
- **Remaining admin forms now covered by e2e (5 more tests, 26 total):** adding a coupon on the offer page; hiding a category, after which it disappears from the public sidebar; renaming a homepage section; connector configuration (enabling an unapproved connector is refused, reconfiguring an approved one works); creating a staff user who can then sign in as an editor. Every admin section has now been used through the browser.
- **Latest results:** typecheck clean; unit + integration **109/109**; `bun run build` OK; **e2e 26/26, twice in a row**. The suite went 17/19 → 18/20 → 20/20 → 20/20 → 21/21 → 21/21 as fixes and tests were added; the failures were the ID bug and two over-broad selectors.

---

## 1. How to restart (important change: logs must live OUTSIDE the project)

**Current (since the resumed session):** one command starts everything, and logs go to `~/Library/Logs/claimable/` automatically.

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd "<project root>"
bun run dev        # foreground: Postgres (reused if running) + migrations + http://localhost:3000 + worker
# or detached, so it survives the terminal or session closing:
DETACH='import os,sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])'
(nohup python3 -c "$DETACH" bun run dev > ~/Library/Logs/claimable/dev-orchestrator.log 2>&1 &)
curl -s localhost:3000/api/health
# stop: kill -TERM $(pgrep -f "bun scripts/dev.ts")   (Postgres keeps running if it was started separately)
```

If pages reload in a loop, stop dev, run `rm -rf .next/dev` and start again (see section 0).

Older manual form (still valid):

```bash
(nohup python3 -c "$DETACH" bun scripts/db-start.ts >> ~/Library/Logs/claimable/db.log 2>&1 &)        # Postgres :5433
(NEXT_TELEMETRY_DISABLED=1 nohup python3 -c "$DETACH" bun run dev:web > ~/Library/Logs/claimable/next-dev.log 2>&1 &)  # http://localhost:3000
```

> **Never write the dev server's output into the project folder** (for example `.data/next-dev.log`). Next's file watcher sees every log line as a change, which sends an HMR reload, which logs another line: an endless loop of about 2 page reloads per second. This was found and fixed this session (section 3.4). Older notes in `PROGRESS.md` still show `.data/next-dev.log`; that path is wrong.

- Admin login: `admin@claimable.local`. The password is in `.data/dev-admin.txt` (mode 600; not recorded here).
- Dev DB `claimable`: **26 researched offers, all published.** Plus reference data, 1 admin user, monitoring jobs and live observations.
- Test DB `claimable_test`: also has the catalog seeded. Integration tests truncate it anyway.

## 2. Completed this session (verified unless noted)

1. **Launch catalog encoded:** `data/catalog/offers.ts` holds 19 companies and **26 offers** from `docs/research/catalog-research-log.md` (observed 2026-10-24):
   - **15 student/education:** GitHub Student Pack, Figma, Notion, Office 365 A1, Azure for Students, Spotify Student (US), Ableton 50%, Google AI Plus (Bangladesh page), Adobe CC Pro students (Colombia page), Miro, Sketch, Unity, Apple Creator Studio education, Apple Music Student (US). Plus Copilot Pro for teachers and maintainers, which is a direct offer.
   - **4 cloud credits:** Azure $200, AWS up to $200, Google Cloud $300, Akamai US$100.
   - **5 trials/intro offers:** Setapp, Google Workspace, Squarespace, Shopify $1/month, Apple Creator Studio 30-day trial.
   - **2 direct deals:** Proton Pass Plus (advertised 40%), Affinity (free).
   - Unknowns stay NULL. Geo-observed prices carry a country rule only for the observed country (BD likely eligible; CO confirmed).
2. **`scripts/seed.ts`** (`bun run db:seed`):
   - Idempotent; seeds reference data and the catalog through the audited admin services.
   - **Resumable:** finishes drafts left by an interrupted run.
   - **`--update`:** applies catalog edits to seed-created offers only, skipping anything a person has edited (`createdBy`/`updatedBy` non-null). Edits go through `updateOffer` and attach/detach sources, all of which write revisions.
   - Verified: first run created and published 26; a rerun created 0; `--update` updated 26.
   - The observation time is `2026-10-24T01:30Z`. The validator correctly rejected an earlier future timestamp.
3. **Card display:** when a promotion's duration is unknown but the eligible duration is known (for example "while you remain a student"), cards now show that instead of "promotion length not disclosed" (`src/server/services/offer-view.ts`).
4. **First live monitoring run against real official sites** (`bun run jobs:run-due`):
   - **19 checks were fully OK** first time.
   - After the corrections below, **25 of 26 offers' official pages pass.** Akamai returns **HTTP 403 to bots**: recorded as blocked and not bypassed; now checked weekly (`monitorIntervalHours: 168`) and re-verified manually.
   - Catalog corrections applied with `--update` (each wrote revisions):
     - Miro moved to `/education-whiteboard/`.
     - Adobe moved to `/education/students/creativecloud.html`. Its prices are filled in by geo-IP in the browser, so the Colombian prices can't be monitored automatically; this is stated in its known limitations.
     - Apple's `/final-cut-pro/trial/` now redirects to `/final-cut-pro/`, which has the same trial and education terms; both Creator Studio offers now use that page.
     - Affinity's page is rendered by JavaScript (241 characters of static HTML), so its expected phrases were removed; the check now confirms reachability only, as its limitations state.
     - The Copilot docs page moved to `/en/copilot/how-tos/copilot-on-github/set-up-copilot/enable-copilot/set-up-for-teachers-and-os-maintainers`; same terms.
5. **Connector bugs found by the live run, fixed, with regression tests:**
   - HTML entities like `&percnt;` weren't decoded, which caused Ableton's false "terms missing". `decodeEntities()` now handles named and hex entities (`tests/unit/html-text.test.ts`).
   - **Timeouts counted the politeness wait.** Each request waited 10 s per host before the 15 s timer, so same-host redirects (robots.txt → page → redirected page) always timed out; this hit GitHub, Adobe, Miro and Apple. The timer now starts per request, after the wait (`rawGet` in `src/server/connectors/http.ts`). The host interval is now read at runtime. Regression test: "same-host redirects don't time out…" in `tests/integration/monitoring.test.ts`.
6. **Dev reload loop** root-caused and fixed: see the warning in section 1.
7. **`scripts/screenshots.ts`** (`bun run screenshots`, also with `PAGES`, `BASE_URL`, `REDUCED_MOTION`, `FULL_PAGE`) captures desktop and mobile shots and reports browser errors and overflow.
   - Result: all desktop pages pass.
   - **Mobile overflow of 57–234 px** came from card grids without an explicit mobile column. Fixed by adding `grid-cols-1` in `src/app/(site)/page.tsx`, `companies/page.tsx`, `companies/[slug]/page.tsx`, `deals/[slug]/page.tsx` and `src/components/discovery/DealsExplorer.tsx`. A recheck of 7 pages × 2 viewports showed **0 errors and 0 overflow**.
8. **Tests:** the last full run was **108 pass, 0 fail** (72 unit + 36 integration). It ran before the grid and Orb edits, which are UI-only; typecheck was clean after the last Orb edit.

## 3. Homepage Orb grey square — RESOLVED (fix verified in the resumed session; history kept below)

- **Symptom:** in headless Chrome (motion enabled), the Orb area on `/` shows a 640×640 opaque grey square with a broken-image glyph. With reduced motion, the static CSS fallback ring renders correctly (verified in a screenshot).
- **Fix 1 (verified):** the Orb root hardcoded `relative`, conflicting with the caller's `absolute`, so it took up layout space and pushed the hero down. Now `className` defaults to `"relative"` and the root no longer adds it. The headline is back at top ≈223 px.
- **Root cause of the grey square (diagnosed, fix NOT yet verified):** React Strict Mode (on in Next dev) runs mount → cleanup → mount. The cleanup calls `WEBGL_lose_context.loseContext()`, but the `<canvas>` was React-managed and survived. The second mount therefore received the **same, now-lost context**, `link()` failed, and it returned early while `live` stayed `true`, leaving a dead canvas painted grey. A diagnostic run confirmed `gl.isContextLost() === true` with canvas opacity 1 and fallback opacity 0.
- **Fix 2 (written, unverified):** `src/components/effects/Orb.tsx` now creates its canvas inside the effect (appended to the container) and removes it on cleanup. Cleanup calls `setLive(false)`. A `webglcontextlost` listener falls back to the static ring, and frames stop once the context is lost. The JSX `<canvas>` and `canvasRef` were removed. Typecheck passes.
- **Next step:** run `PAGES='[["home","/"]]' bun run screenshots` and view `artifacts/screenshots/home-desktop.png` and `home-mobile.png`. The scratch helper scripts lived in the session scratchpad and may be gone. To see real WebGL in headless Chrome, launch with `args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]`; WarpText rendered under SwiftShader. Expect either the animated orb or the static ring, never a grey square. Also confirm GooeyNav and WarpText are unaffected: GooeyNav's cleanup doesn't lose its context, and WarpText already creates its canvas per mount.

## 4. Open items in the dev DB — RESOLVED (closed with notes through `/admin/review`; the queue is empty)

- The open review items are 2× `markers_missing` (Ableton, now fixed by the decoder; Affinity, phrases removed) and 1× `redirect_changed` (Apple Final Cut trial; source updated). Akamai's "blocked" item opens only after 3 consecutive failures.
- **Resolve them through `/admin/review`** in the browser; this doubles as the pending admin-UI test.
- Monitoring job history and observations are visible at `/admin/sources`.

## 5. Files created or changed this session

- **New:** `data/catalog/offers.ts`, `scripts/seed.ts`, `scripts/screenshots.ts`, `tests/unit/html-text.test.ts`, `docs/SESSION_CHECKPOINT.md`.
- **Changed:**
  - `src/server/connectors/http.ts` (entity decoding, per-request timeout after the politeness wait, runtime host interval)
  - `src/server/services/offer-view.ts` (eligible-duration display)
  - `src/components/effects/Orb.tsx` (positioning, context-loss handling, per-mount canvas; unverified)
  - the five grid files listed in 2.7
  - `tests/integration/monitoring.test.ts` (redirect regression test)
- **Data:** the dev DB and test DB were seeded. Logs from this session are in `~/Library/Logs/claimable/` (`next-dev.log`, `live-check-1..3.log`).
- **Resumed session:**
  - New: `tests/e2e/flows.test.ts`, `tests/e2e/server.ts`, `scripts/dev.ts`, `src/app/not-found.tsx`, `src/components/layout/NotFoundContent.tsx`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/DESIGN_SYSTEM.md`.
  - Changed:
    - `src/lib/labels.ts` (visitor-eligibility wording)
    - `src/app/(site)/deals/[slug]/page.tsx` (condition descriptions, server country names)
    - `src/components/admin/fields.tsx` (`scope`, `aria-label`)
    - admin pages: offers/[id], categories, homepage, companies/[id], sources, review, calendar (scoped IDs)
    - `src/app/(site)/not-found.tsx` (shared content)
    - `src/components/layout/{SearchBox,CountrySelector,SiteHeader}.tsx`
    - `src/app/(site)/page.tsx` (mobile Orb)
    - `scripts/screenshots.ts` (`CHROME_ARGS`, `SUFFIX`, hydration diff, `caret: "initial"`)
    - `CLAUDE.md` (confirmed commands)
  - Data: the 3 dev review items were resolved. The e2e suite resets `claimable_test` on each run.

## 6. Remaining tasks (priority order)

Done this session: the Orb fix and screenshot passes, admin UI flows, the e2e suite, the production build, `scripts/dev.ts`, the product, data-model and design-system docs, `CLAUDE.md` commands, the research top-up to 32 offers, and the `PROGRESS.md` refresh.

1. **Further research (optional)**, on official pages only: the Microsoft 365 college offer, official coupon pages, RSS feed URLs for `rss-announcements`, and historical promotions with sources for the calendar. **No coupons or calendar events have official evidence yet**, so the Coupons page and the calendar show honest empty states.
2. Optional docs: `SOURCES.md` (connector permissions and the per-source policy) and `VERIFICATION.md`. The content is mostly in `DATA_MODEL.md`, `/methodology` and the connector rows.
3. Deployment, which needs owner decisions: hosting, `SESSION_SECRET`/`CRON_SECRET`, managed Postgres, and the product name.

## 7. Known issues and decisions

- The catalog has **32 offers** (brief target 30–50). Exclusions and reasons are in the research log. There are no official coupon codes or calendar events yet.
- The Google AI (BD) and Adobe (CO) prices are geo-dependent; automated checks can't see them, so they need editorial re-verification when they go stale.
- Fixed in the resumed session: the default 404 for unmatched URLs, the `Intl` country-label risk, and the header search not prefilling `q`.
- Still open: filter GET URLs are verbose (empty params; parsing handles them). Embedded Postgres runs under Rosetta. Akamai blocks bots (403), so it's re-verified manually.
- **Open owner decisions (not blocking):** product name; partner/affiliate credentials (the partner connector stays not configured); hosting; auth provider for future visitor accounts.

## 8. Estimated MVP completion (same weights as PROGRESS.md section 8)

Updated after the resumed session. Verified work counts fully; deferred features are excluded.

| Area | Weight | Est. | Basis |
| --- | ---: | ---: | --- |
| UI and responsive design | 14% | 85% | Orb verified. Two consecutive full SwiftShader passes (30/30) plus a reduced-motion pass (30/30). Duplicate-ID and accessible-name fixes, branded 404. No formal automated accessibility audit (axe) yet. |
| Search, filters, country eligibility | 12% | 90% | e2e: search, header query prefill, country choice, confirmed-unavailable hiding with "Show it", mobile drawer Apply, chips, back navigation, Clear all |
| Offer details, coupon/claim | 12% | 88% | e2e: renewal and restrictions before Claim; Claim → approved merchant plus event; reveal → copy, copy failure, no-JS reveal; expired page. No real coupon codes are published (no official evidence). |
| Database and backend | 14% | 90% | Production build passes; `bun run dev` orchestrator; seed with idempotent, resumable and update modes |
| Admin dashboard | 12% | 93% | Every admin form exercised in e2e through the UI: login, company, offer form, source, verification, publish, coupon add, review resolution, calendar events, categories, homepage sections, connector config (with the permission guard), user creation, editor restrictions. |
| Connectors and monitoring | 12% | 84% | Live checks against 32 official pages (6 new ones passed first time, one redirect handled through review); the worker now runs in dev. RSS feeds unconfigured; partner feed blocked on credentials. |
| Verification, expiry, history | 10% | 90% | Expired-state e2e; report → review → close e2e; review items resolved for real in the dev DB; duplicate-history bug fixed and tested |
| Deals Calendar | 6% | 70% | e2e: sourced historical entry, two-year prediction labelled "Predicted — not announced", unpublished events hidden. No evidence-backed events in the dev DB yet. |
| Testing and production readiness (incl. launch content) | 8% | 78% | 109 unit/integration + 21 e2e, build OK, docs written. The catalog has 32 evidence-backed offers; no official coupon codes or calendar events yet; not deployed. |

**Overall ≈ 87% (estimate).**
Weighted: 14×.85 + 12×.90 + 12×.88 + 14×.90 + 12×.93 + 12×.84 + 10×.90 + 6×.70 + 8×.78 = 86.5.

## 9. Exact resume steps

1. Start with `bun run dev` (section 1) and check `/api/health`. If pages reload in a loop, stop dev, run `rm -rf .next/dev` and restart.
2. Continue section 6 from item 1.
3. After any code change, run `bun run typecheck && bun test tests/unit tests/integration` (last result: 109/109). For UI or admin changes, also run `bun run build && bun run test:e2e` (last result: 26/26), one suite after the other. Then update this file.
