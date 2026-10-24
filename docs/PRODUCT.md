# Product

**Claimable** (working name; see `src/lib/site.ts`) is a software-offer discovery site: discounts, student offers, coupons, free trials, cloud credits and lifetime deals, each shown with its eligibility, real cost and evidence. The full intent is in `docs/PRODUCT_BRIEF.md`; this page describes the MVP as built.

> Find the right deal. Know whether you qualify. Understand the real cost.

## Who it's for

People about to pay for software, including students and people outside the US and EU, whose main questions are "can I actually claim this here?" and "what will it cost after the promotion?". Staff (editors and administrators) research, verify and maintain the offers.

## What a visitor can do (no account needed)

| Page | Purpose |
| --- | --- |
| `/` | Homepage sections made only from real data. Their order and visibility are set in the admin; a section without enough offers is hidden rather than padded. |
| `/deals` | Search (typo-tolerant), multi-select filters (deal type, category, verification, free, price cap in one currency, discount, billing, platform, customer type, ending soon), sort, grid or list view. Filters live in the URL. |
| `/categories/[slug]`, `/students`, `/coupons`, `/free-trials`, `/lifetime-deals` | The same explorer with a fixed filter. Student offers, coupons, trials and lifetime deals are offer types that cut across categories. |
| `/deals/[slug]` | Offer detail: pricing and renewal table, first-12-months total, who can claim it (country rules, customer and student conditions), student requirements, terms summary, verification and sources, history timeline, related offers, report a problem. |
| `/companies`, `/companies/[slug]` | Company pages with current offers and a promotion timeline. |
| `/calendar` | Deals Calendar: Month, Upcoming and History views, with confirmed, historical and predicted events labelled and styled differently. |
| `/submit`, `/methodology` | Deal submission (enters review), and how verification works, including the affiliate and sponsorship disclosure. |

**Country.** The visitor picks a country (stored in a cookie; a `?country=` URL parameter overrides it per page). Offers confirmed as unavailable there are hidden, with a count and a "Show them" link. Other offers carry "Available in", "Likely in" (pending verification) or "Not confirmed for". Being able to open a page from a country is never treated as eligibility.

**Actions.**
- *Claim Deal*, *Start free trial*, *Claim credits* and *View lifetime deal* go through `/go/<slug>`, which redirects only to the company's approved domains and records an outbound interaction.
- Student offers use *Verify student eligibility*, *Claim student offer* or *View student discount*, and verification happens on the merchant's or provider's side.
- Coupons use *Reveal Code* → *Copy*, with copy feedback, a manual fallback and a merchant link. Revealing works without JavaScript.

## What staff can do (`/admin`)

- Create companies, products, plans and reliable list prices; create and edit offers. Unknown values stay empty and display as "Not disclosed".
- Attach sources with expected terms, record verification evidence, add coupons with their status, and publish or archive offers. Publishing is blocked until the required evidence exists.
- Work the review queue: monitoring findings, visitor reports, submissions and discovery candidates. Closing an item needs a note, and nothing changes an offer automatically.
- Manage connectors and jobs (admins only), calendar events, homepage sections, categories and users (admins only). Staff can also read the audit log and analytics.

## How offers stay accurate

- **Evidence first.** Every published offer has at least one source. Verification has a state, a method, a date and optional country and evidence URL, and it goes stale after 7, 30 or 90 days depending on risk.
- **Scheduled monitoring.** Official pages are fetched politely (robots.txt, per-host rate limits, no login, CAPTCHA or anti-bot bypass). Missing terms, 404s and redirects open review. Timeouts and errors back off and escalate after 3 failures; they never expire an offer.
- **Expiry.** Only a confirmed end date expires an offer automatically. Expired offers stay visible with their history and are archived after 30 days.
- **Honest numbers.** Savings appear only against a reliable list price for the same plan, currency and billing interval. Introductory savings are labelled separately from the renewal price, and advertised percentages are labelled as advertised.
- **Community input is reviewed.** Reports and submissions are rate-limited and anonymised, and they go to the review queue. One report never changes an offer.
- **Disclosure.** Affiliate links and sponsored placements are labelled. Neither affects verification or ranking.

## Launch catalog

32 researched offers from 24 companies, observed on 2026-10-24 from official pages (`data/catalog/offers.ts`, evidence in `docs/research/catalog-research-log.md`). That's within the brief's 30–50 range. Candidates without enough official evidence were left out rather than guessed, and the log records why.
- **Lifetime:** one offer, DaisyDisk's standard one-time licence (labelled as the standard price, not a discount).
- **Not yet published:** coupon codes and calendar events, because none had official evidence at research time. The Coupons page and the calendar therefore show honest empty states.

## Not in the MVP

Visitor accounts, saved deals, follows and notifications (the next phase); reputation systems, browser extensions, native apps, AI assistants, advanced prediction, large-scale checkout testing, enterprise analytics and a public API (deferred, brief §31).
