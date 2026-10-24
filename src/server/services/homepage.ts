/**
 * Homepage sections: admin-controlled order/visibility, and each section only appears when it
 * has at least `minItems` real items. Nothing is padded or invented.
 */
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { companies, homepageSections, promotionalEvents } from "../db/schema";
import { rankOffers } from "../domain/ranking";
import { trendingCompanyIds } from "./analytics";
import { fixturesVisible, loadPublicOffers, type OfferBundle } from "./bundles";
import { decideOffer, toCardView, toRankable, type OfferCardView, type OfferDecision } from "./offer-view";

export type HomepageSection =
  | { key: string; title: string; description: string; kind: "offers"; items: OfferCardView[]; href?: string }
  | { key: string; title: string; description: string; kind: "events"; items: { id: string; title: string; company: string; companySlug: string; startsOn: string; endsOn: string | null }[] }
  | { key: string; title: string; description: string; kind: "companies"; items: { slug: string; name: string; interactions: number }[] };

const DAY = 86_400_000;

/** Offers left out of the "Recently verified" section only; they still appear everywhere else. */
const RECENTLY_VERIFIED_EXCLUDED_SLUGS = new Set(["parallels-desktop-pro-education-discount"]);

export async function getHomepage(country: string | null, now: Date = new Date()) {
  const [config, bundles] = await Promise.all([
    db.select().from(homepageSections).where(eq(homepageSections.isVisible, true)).orderBy(asc(homepageSections.sortOrder)),
    loadPublicOffers(),
  ]);
  const decided = bundles
    .map((bundle) => ({ bundle, decision: decideOffer(bundle, { country, now }) }))
    .filter(({ decision }) => decision.country.status !== "confirmed_ineligible");

  const rank = (list: { bundle: OfferBundle; decision: OfferDecision }[], sort: Parameters<typeof rankOffers>[1], max: number) =>
    rankOffers(list.map((d) => ({ ...toRankable(d.bundle, d.decision), d })), sort, { hasQuery: false, now })
      .slice(0, max)
      .map((r) => toCardView(r.d.bundle, r.d.decision));
  const inCategory = (...slugs: string[]) => decided.filter((d) => d.bundle.categories.some((c) => slugs.includes(c.slug)));

  const sections: HomepageSection[] = [];
  for (const s of config) {
    const base = { key: s.key, title: s.title, description: s.description };
    let section: HomepageSection | null = null;
    switch (s.key) {
      case "recently_verified":
        section = { ...base, kind: "offers", href: "/deals?sort=recently_verified", items: rank(
            decided.filter(
              (d) =>
                ["officially_confirmed", "redemption_tested", "evidence_supported"].includes(d.decision.verification.state) &&
                !RECENTLY_VERIFIED_EXCLUDED_SLUGS.has(d.bundle.offer.slug),
            ),
            "recently_verified",
            s.maxItems,
          ),
        };
        break;
      case "student":
        section = { ...base, kind: "offers", href: "/students", items: rank(decided.filter((d) => d.bundle.offer.studentRequired || d.bundle.offer.offerType === "student"), "relevance", s.maxItems) };
        break;
      case "ai":
        section = { ...base, kind: "offers", href: "/categories/ai", items: rank(inCategory("ai"), "relevance", s.maxItems) };
        break;
      case "creative":
        section = { ...base, kind: "offers", href: "/categories/design", items: rank(inCategory("design", "video-audio"), "relevance", s.maxItems) };
        break;
      case "free_trials":
        section = { ...base, kind: "offers", href: "/free-trials", items: rank(decided.filter((d) => ["free_trial", "promo_credit"].includes(d.bundle.offer.offerType)), "relevance", s.maxItems) };
        break;
      case "lifetime":
        section = { ...base, kind: "offers", href: "/lifetime-deals", items: rank(decided.filter((d) => d.bundle.offer.offerType === "lifetime"), "relevance", s.maxItems) };
        break;
      case "expiring_soon":
        section = {
          ...base,
          kind: "offers",
          href: "/deals?sort=expiring_soon",
          items: rank(decided.filter((d) => d.bundle.offer.endsAtConfirmed && d.bundle.offer.endsAt && d.bundle.offer.endsAt.getTime() - now.getTime() < 14 * DAY && d.bundle.offer.endsAt > now), "expiring_soon", s.maxItems),
        };
        break;
      case "new_this_week":
        section = { ...base, kind: "offers", href: "/deals?sort=newest", items: rank(decided.filter((d) => d.bundle.offer.publishedAt && now.getTime() - d.bundle.offer.publishedAt.getTime() < 7 * DAY), "newest", s.maxItems) };
        break;
      case "upcoming_sales": {
        const today = now.toISOString().slice(0, 10);
        const rows = await db
          .select({ id: promotionalEvents.id, title: promotionalEvents.title, startsOn: promotionalEvents.startsOn, endsOn: promotionalEvents.endsOn, company: companies.name, companySlug: companies.slug })
          .from(promotionalEvents)
          .innerJoin(companies, eq(companies.id, promotionalEvents.companyId))
          .where(
            and(
              eq(promotionalEvents.kind, "confirmed"),
              eq(promotionalEvents.isPublished, true),
              gte(sql`coalesce(${promotionalEvents.endsOn}, ${promotionalEvents.startsOn})`, today),
              fixturesVisible() ? sql`true` : eq(promotionalEvents.isFixture, false),
            ),
          )
          .orderBy(asc(promotionalEvents.startsOn))
          .limit(s.maxItems);
        section = { ...base, kind: "events", items: rows };
        break;
      }
      case "trending_companies": {
        const trending = await trendingCompanyIds();
        const rows = trending.length ? await db.select({ id: companies.id, slug: companies.slug, name: companies.name }).from(companies).where(inArray(companies.id, trending.map((t) => t.companyId))) : [];
        section = {
          ...base,
          kind: "companies",
          items: trending.map((t) => ({ ...rows.find((r) => r.id === t.companyId)!, interactions: t.interactions })).filter((r) => r.slug).slice(0, s.maxItems),
        };
        break;
      }
    }
    if (section && section.items.length >= s.minItems) sections.push(section);
  }

  const lastVerified = bundles.reduce<Date | null>((latest, b) => (b.offer.verifiedAt && (!latest || b.offer.verifiedAt > latest) ? b.offer.verifiedAt : latest), null);
  return {
    sections,
    stats: {
      offers: bundles.length,
      companies: new Set(bundles.map((b) => b.company.id)).size,
      lastVerified,
    },
  };
}
