/**
 * Idempotent reference data: countries, region groups, categories, homepage sections and
 * the connector registry. Safe to run on every deploy.
 */
import { sql } from "drizzle-orm";
import { COUNTRIES, REGION_GROUPS } from "@/lib/countries";
import type { DbOrTx } from "../db";
import { categories, connectors, countries, homepageSections, regionGroupCountries, regionGroups } from "../db/schema";

export const CATEGORY_SEED = [
  { slug: "ai", name: "AI & Machine Learning", description: "AI assistants, image and video generation, voice AI, coding agents, research tools, model APIs and automation." },
  { slug: "design", name: "Design & Creative", description: "Graphic design, UI/UX, illustration, photography, prototyping, animation, fonts and creative assets." },
  { slug: "video-audio", name: "Video & Audio", description: "Video editing, motion graphics, sound production, music software and post-production." },
  { slug: "hosting", name: "Hosting & Domains", description: "Web hosting, domains, cloud infrastructure, storage, CDN and deployment platforms." },
  { slug: "development", name: "Development & Coding", description: "IDEs, developer tools, Git services, databases, APIs, testing and security tooling." },
  { slug: "productivity", name: "Productivity & Collaboration", description: "Project management, documents, notes, communication, scheduling and automation." },
  { slug: "marketing", name: "Marketing & Business", description: "SEO, CRM, email marketing, analytics, social media and storefront tools." },
  { slug: "education", name: "Education & Learning", description: "Learning platforms, courses, research resources, student tools and certifications." },
  { slug: "entertainment", name: "Entertainment", description: "Streaming, music, gaming subscriptions, reading platforms and digital entertainment." },
  { slug: "security", name: "Security & Privacy", description: "VPNs, password managers, encrypted storage, backup and cybersecurity software." },
];

export const HOMEPAGE_SECTION_SEED = [
  { key: "recently_verified", title: "Recently verified", description: "Offers whose terms we confirmed most recently.", sortOrder: 10, maxItems: 6, minItems: 3 },
  { key: "student", title: "Student discounts", description: "Free and discounted software for students, with the verification each one needs.", sortOrder: 20, maxItems: 6, minItems: 3 },
  { key: "ai", title: "AI tools", description: "Offers on AI assistants, coding agents and model platforms.", sortOrder: 30, maxItems: 4, minItems: 2 },
  { key: "creative", title: "Creative software", description: "Design, video and audio tools.", sortOrder: 40, maxItems: 4, minItems: 2 },
  { key: "free_trials", title: "Free trials and promotional credits", description: "Try before paying — check what happens when the trial ends.", sortOrder: 50, maxItems: 4, minItems: 2 },
  { key: "expiring_soon", title: "Expiring soon", description: "Only offers with a confirmed end date.", sortOrder: 60, maxItems: 4, minItems: 1 },
  { key: "upcoming_sales", title: "Upcoming sales", description: "Officially announced promotions.", sortOrder: 70, maxItems: 4, minItems: 1 },
  { key: "lifetime", title: "Lifetime deals", description: "One-time purchases under specific vendor terms.", sortOrder: 80, maxItems: 4, minItems: 2 },
  { key: "new_this_week", title: "New this week", description: "Published in the last seven days.", sortOrder: 90, maxItems: 4, minItems: 2 },
  { key: "trending_companies", title: "Trending companies", description: "Most outbound interactions in the last 14 days.", sortOrder: 100, maxItems: 6, minItems: 3 },
];

export const CONNECTOR_SEED = [
  {
    key: "official-page-monitor",
    name: "Official page monitor",
    kind: "monitor" as const,
    description:
      "Re-fetches official offer, pricing and student pages attached to published offers, checks configured terms markers and records observations. Never changes offer status by itself.",
    permissionBasis:
      "Public pages on the merchant's own site, fetched at low frequency with an identifying user agent; robots.txt is honoured and pages behind login, CAPTCHA or anti-bot controls are not accessed.",
    permissionStatus: "approved" as const,
    retrievalMethod: "HTTPS GET, robots.txt respected, ≤ 6 requests/minute overall, ≥ 10 s between requests to one host, 15 s timeout, 2 MB limit",
    authRequired: false,
    intervalMinutes: 15,
    rateLimitPerMinute: 6,
    enabled: true,
    config: { maxChecksPerRun: 20 },
  },
  {
    key: "rss-announcements",
    name: "Official announcement feeds",
    kind: "discovery" as const,
    description:
      "Reads RSS/Atom feeds that companies publish for syndication and turns posts mentioning promotions into discovery candidates for human review. Candidates are never published automatically.",
    permissionBasis: "RSS/Atom feeds are published by the companies for machine consumption; only titles, links and dates are stored, not article bodies.",
    permissionStatus: "approved" as const,
    retrievalMethod: "HTTPS GET of configured feed URLs, robots.txt respected, once per day",
    authRequired: false,
    intervalMinutes: 24 * 60,
    rateLimitPerMinute: 6,
    enabled: true,
    config: {
      keywords: ["discount", "% off", "sale", "black friday", "cyber monday", "student", "education", "free trial", "promo", "deal", "lifetime", "credits"],
      lookbackDays: 30,
      feeds: [] as { url: string; companySlug: string }[],
    },
  },
  {
    key: "partner-json-feed",
    name: "Authorized partner feed (JSON)",
    kind: "feed" as const,
    description:
      "Imports offers from an affiliate network or partner API that grants deal-data usage rights. Items are validated, deduplicated against existing offers and routed to review.",
    permissionBasis: "Requires a signed partner/affiliate agreement that permits displaying deal data. Not configured: no agreement or credentials exist yet.",
    permissionStatus: "not_configured" as const,
    retrievalMethod: "HTTPS GET with bearer token from PARTNER_FEED_TOKEN; URL from PARTNER_FEED_URL",
    authRequired: true,
    intervalMinutes: 6 * 60,
    rateLimitPerMinute: 2,
    enabled: false,
    config: { mapping: { externalId: "id", title: "title", url: "url", code: "code", companyDomain: "merchant_domain", startsAt: "starts_at", endsAt: "ends_at", countries: "countries", discountPercent: "discount_percent" } },
  },
];

export async function seedReferenceData(db: DbOrTx) {
  await db
    .insert(countries)
    .values(COUNTRIES.map((c) => ({ code: c.code, name: c.name })))
    .onConflictDoUpdate({ target: countries.code, set: { name: sql`excluded.name` } });

  for (const [code, group] of Object.entries(REGION_GROUPS)) {
    await db.insert(regionGroups).values({ code, name: group.name }).onConflictDoUpdate({ target: regionGroups.code, set: { name: group.name } });
    await db
      .insert(regionGroupCountries)
      .values(group.members.map((countryCode) => ({ regionCode: code, countryCode })))
      .onConflictDoNothing();
  }

  await db
    .insert(categories)
    .values(CATEGORY_SEED.map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 })))
    .onConflictDoNothing({ target: categories.slug });

  await db.insert(homepageSections).values(HOMEPAGE_SECTION_SEED).onConflictDoNothing({ target: homepageSections.key });

  for (const c of CONNECTOR_SEED) {
    // Insert once; afterwards administrators own the configuration.
    await db.insert(connectors).values(c).onConflictDoNothing({ target: connectors.key });
  }
}
