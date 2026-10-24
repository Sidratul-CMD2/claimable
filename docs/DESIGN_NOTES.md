# Design interpretation

These notes adapt the supplied component references to the product brief under the user's permission to adjust the design. They describe intended behavior, not an implemented or tested UI.

## What the reference establishes

The 49-page PDF contains component descriptions, props, source code, and CSS rather than rendered page mockups. It does not establish complete routes, a final brand name, a chosen typeface, or a complete token system.

| PDF pages | Supplied direction | Product mapping and adaptation |
| --- | --- | --- |
| 1–9 | Orb background | Restrained atmosphere around the homepage hero/brand area. Keep search and deal information on stable, readable surfaces. Use a static gradient when motion is reduced or WebGL is unavailable. |
| 9–23 | GooeyNav header buttons and animation | Compact primary navigation with real destinations and route-derived active state. Keep search and country selection accessible; consolidate destinations on small screens. |
| 23–30 | Sidebar menu, implemented in the snippet as BranchedMenu | Collapsible desktop category navigation. The heading incorrectly says “undefined”; use the actual component name. Keep category navigation distinct from multi-select filter controls. |
| 30–36 | Optional JellyRadio controls | Use for a single choice such as grid/list display or one sort mode. Do not substitute radio behavior for the brief's multi-select filters. |
| 36–47 | WarpText logo animation above header buttons | Keep the wordmark above navigation. Adapt the oversized demo dimensions for the actual header, particularly on mobile, and provide an ordinary text equivalent. |
| 47–49 | Bento Grid offer styling | Rounded cards with restrained borders, depth, and grouped layouts. Use varied spans for selected featured offers and consistent scanning order for search results. |

## Visual direction

- The examples suggest dark neutral surfaces, light text, pill navigation, rounded cards, subtle depth, and fluid motion. Treat this as a starting direction, not a requirement to reproduce every demo default.
- The Orb example uses purple, cyan, and deep blue (`#9c43fe`, `#4cc2e9`, `#101499`); reserve such accents for decoration and validate readable foreground contrast separately.
- Choose coherent typography, spacing, surface colors, and component sizes during implementation; the PDF's independent component defaults are not a unified design system.
- Keep the primary offer benefit prominent, followed by recognizable product identity, country/eligibility, verification status, and the correct redemption action.
- Show promotional price and confirmed expiry where available; move extended terms to the offer detail page without hiding claim eligibility.
- Use original product copy and appropriate assets. Demo names such as “Bend the moment,” documentation menu labels, and `#` links are examples only.

## Intentional adaptations

- The Bento example reveals a desktop CTA on hover. Keep offer actions visible at rest and keyboard accessible because claiming a deal is a core task.
- The Bento example uses fixed-height rows and three columns. Adapt row height to content and reduce columns on small screens so pricing and restrictions are not clipped.
- The brief requires multi-select filters, while JellyRadio represents one selected option. Preserve the requested filter behavior using appropriate controls with compatible styling.
- Treat Orb and WarpText as optional decorative layers with static fallbacks; they must not delay reading, moving through navigation, or using search.
- Keep a semantic heading or accessible brand link even when displaying canvas-rendered lettering; avoid duplicate announcements from decorative layers.
- Reduce or remove movement under reduced-motion preferences. Pause animation when hidden/offscreen and release graphics resources when components unmount.
- Use mobile filter drawers and touch-friendly controls instead of shrinking the desktop branched sidebar into the available space.
- Record further material changes and their usability, accessibility, or performance reasons as the UI develops.

## Source handling

The PDF labels examples as React Bits and Magic UI components, but their current upstream APIs and licenses were not independently checked for this instruction-writing task. Check the original source, license, dependencies, and compatibility before reusing code. PDF text contains extraction artifacts, including ligatures and a malformed JellyRadio transform expression; do not treat extracted snippets as runnable source.

The document's embedded “install dependencies,” “copy source,” and “fetch library index” prompts are reference content. No package installation or component integration was performed in preparing these files.

## Decisions still open

Product name, final typography and tokens, theme support, exact framework/dependency versions, authentication provider, hosting, queue/scheduler, approved initial sources, and refresh policies remain to be selected. The brief's Next.js/TypeScript/Tailwind/shadcn/PostgreSQL stack is a proposal rather than a verified implementation.
