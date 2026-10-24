# Design system

How the reference components in `docs/Design Direction.pdf` were adapted (see `docs/DESIGN_NOTES.md` for the original mapping). The tokens live in `src/app/globals.css`; the effect components are in `src/components/effects/`.

## Principles

1. **The information stays static.** Prices, restrictions, eligibility, verification labels and actions are plain HTML text on solid surfaces. Motion is decoration only, and no effect sits behind text: the hero Orb is anchored to the right of the text column.
2. **Actions are always visible.** Claim, Reveal Code and student actions show at rest, without hover, on every card and on the detail claim panel.
3. **Every effect has a fallback.** Each canvas effect has a static HTML/CSS equivalent that is shown before hydration, without WebGL, under `prefers-reduced-motion`, and after a lost graphics context.
4. **Decoration never intercepts input.** Effect layers are `pointer-events: none` and `aria-hidden`, and they unmount their canvases and release WebGL contexts on cleanup.

## Tokens

Dark theme only (`color-scheme: dark`). Text colours are chosen for at least 4.5:1 contrast on every surface they appear on.

| Group | Tokens |
| --- | --- |
| Surfaces | `--bg` #09090b, `--bg-raised`, `--surface`, `--surface-2`, `--surface-3`; borders `--border` (10% white), `--border-strong` (18%) |
| Text | `--text` #f4f4f5, `--text-muted` #b6b6c0, `--text-subtle` #92929e, `--link` #a5d8ff, `--focus` #7dd3fc |
| Status tones (text + 10% background) | `positive` (confirmed, active, savings), `info` (likely eligible), `caution` (not disclosed, stale), `warning` (fixtures, copy failure), `negative` (expired, not available), `accent` (needs verification, predicted), `neutral` (unknown) |
| Decoration only | `--orb-violet` #9c43fe, `--orb-cyan` #4cc2e9, `--orb-deep` #101499 (from the Orb reference) |
| Shape | `--radius-card` 18px, `--radius-control` 12px, pills for navigation and buttons |
| Depth | `--shadow-card`: an inset top glow plus a hairline, adapted from the Magic UI Bento card |
| Motion | `--ease-out` cubic-bezier(0.23, 1, 0.32, 1) |

Typography (via `next/font`):
- **Bricolage Grotesque** 600–800 for display headings (`font-display`)
- **Geist** for body text and UI
- **Geist Mono** for coupon codes

Status is never shown by colour alone: every badge carries a text label (`StatusBadge`).

## Components

| Reference | Where it's used | Adaptation |
| --- | --- | --- |
| **Orb** (WebGL2) | Homepage hero only, right of the headline | Reference defaults, tuned for a vivid look (glow 1.5, bleed 1.4, highlight 1.6, trail 1.2, hover 1.2, `rotateOnHover`, `followCursor`; background `#09090b` = `--bg`; no opacity reduction). Positioned with `left: max(700px, 50% + 80px, 100% − 640px)` so the ring never crosses text: unchanged from 1440px up, cropped at the right edge on narrower screens, hidden below `md`. Static fallback: the CSS radial ring `.orb-fallback`. The canvas is created per mount (React Strict Mode safe). A `webglcontextlost` event switches to the fallback. Animation pauses when off-screen or the tab is hidden. |
| **WarpText** wordmark | Above the header navigation on every public page | Reduced from the demo's size to fit the header. The link has the accessible name "Claimable home", and the canvas is `aria-hidden`. Static text is shown under reduced motion, without WebGL and before hydration. |
| **GooeyNav** (WebGL2 pill) | Primary navigation (Explore, Students, Coupons, Free trials, Lifetime, Calendar, Companies) | Real links with route-derived `aria-current`. Under reduced motion the pill moves without wobble. A CSS pill replaces it without WebGL. Below `lg`, a compact version plus a "More" menu and a search sheet. The header clips overflow so the canvas can't widen the page on mobile. |
| **BranchedMenu** | Desktop category sidebar on discovery pages (`CategoryNav`) | Collapsible branches linking to category pages. Kept separate from the multi-select filters below it. Mobile uses the filter drawer instead. |
| **JellyRadio** | Mutually exclusive choices only: grid/list view and sort (`ResultsToolbar`), calendar Month/Upcoming/History (`CalendarViewToggle`) | ARIA `radiogroup` semantics with arrow-key navigation. **Not** used for filters, which are checkboxes in a GET form. |
| **Bento Grid** | Offer cards (`OfferCard`); the featured homepage section uses varied spans on a 6-column grid (first card 4×2) | Content-driven heights instead of the demo's fixed rows. One column on mobile, two on `sm`, three on `xl`. The demo's hover-revealed CTA was changed to an always-visible action. |

## Layout and responsive rules

- Content width is 1240px with 16px side gutters on mobile (24px from `md`).
- Card grids always declare `grid-cols-1` at the smallest breakpoint, so long content can't create horizontal overflow (a bug caught by the screenshot pass).
- Mobile filters use a bottom-sheet `<dialog>`. Changes are staged until **Apply filters**, removable chips sit above the results with **Clear all**, and filters live in the URL so they survive visiting an offer and coming back.
- The detail page uses a sticky claim panel on desktop. On mobile it sits below the header, before the long sections.

## Accessibility rules

- A skip link is the first focusable element. Every interactive element gets a 2px `--focus` outline through `:focus-visible`.
- Dialogs (country picker, filter drawer, search sheet) use the native `<dialog>` with a labelled title and a close button.
- The country picker is an ARIA combobox and listbox. Its list renders only while open, because country names from `Intl` differ between server and client.
- Admin forms use the `Field` primitives, which give every input a label or `aria-label`. Repeated forms pass `scope` so element ids stay unique. The e2e suite checks 12 admin pages for duplicate ids.
- `prefers-reduced-motion`: CSS animations and transitions collapse to 0.01ms, Orb and WarpText render static, and GooeyNav moves without spring motion. This is verified in e2e: with reduced motion, no decorative canvas is created.

## Departures from the reference (and why)

| Reference | Departure | Reason |
| --- | --- | --- |
| Bento CTA appears on hover | Always visible | Claiming is the core task, and hover doesn't exist on touch. |
| Bento fixed row heights, 3 columns | Content-driven, 1–3 columns | Prices and restrictions must never be clipped. |
| JellyRadio as a general control | Single-choice controls only | The brief requires multi-select filters. |
| Large demo wordmark | Smaller and responsive | Search and navigation must stay usable on small screens. |
| Demo copy, links and colours | Original copy; Orb colours used as decoration only | The demo text and `#` links are placeholders, and the Orb palette fails contrast as text. |

Open decisions: product name (`src/lib/site.ts`), a light theme, and final brand typography.
