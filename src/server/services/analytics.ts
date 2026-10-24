/**
 * Privacy-conscious analytics: aggregate events only. No IP addresses, user agents, cookies
 * or cross-site identifiers. A "claim" is an outbound interaction, never a purchase.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AnalyticsType } from "@/lib/enums";
import { db } from "../db";
import { analyticsEvents, offers } from "../db/schema";

export async function recordEvent(e: {
  type: AnalyticsType;
  offerId?: string | null;
  query?: string | null;
  resultCount?: number | null;
  countryCode?: string | null;
  path?: string | null;
}) {
  try {
    await db.insert(analyticsEvents).values({
      type: e.type,
      offerId: e.offerId ?? null,
      query: e.query ? e.query.slice(0, 100).toLowerCase() : null,
      resultCount: e.resultCount ?? null,
      countryCode: e.countryCode ?? null,
      path: e.path?.slice(0, 200) ?? null,
    });
  } catch (error) {
    // Analytics must never break a page.
    console.error("[analytics] failed to record event", error);
  }
}

export async function analyticsSummary(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [totals, topSearches, zeroResults, topOffers] = await Promise.all([
    db
      .select({ type: analyticsEvents.type, count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, since))
      .groupBy(analyticsEvents.type),
    db
      .select({ query: analyticsEvents.query, count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.type, "search"), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({ query: analyticsEvents.query, count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.type, "search"), eq(analyticsEvents.resultCount, 0), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({
        offerId: analyticsEvents.offerId,
        title: offers.title,
        slug: offers.slug,
        views: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'offer_view')::int`,
        claims: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'claim')::int`,
        reveals: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'reveal')::int`,
        copies: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'copy')::int`,
      })
      .from(analyticsEvents)
      .innerJoin(offers, eq(offers.id, analyticsEvents.offerId))
      .where(gte(analyticsEvents.createdAt, since))
      .groupBy(analyticsEvents.offerId, offers.title, offers.slug)
      .orderBy(desc(sql`count(*)`))
      .limit(15),
  ]);
  return { days, totals: Object.fromEntries(totals.map((t) => [t.type, t.count])) as Partial<Record<AnalyticsType, number>>, topSearches, zeroResults, topOffers };
}

/** Companies with the most outbound interactions recently (homepage "Trending"). */
export async function trendingCompanyIds(days = 14, minInteractions = 5): Promise<{ companyId: string; interactions: number }[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({ companyId: offers.companyId, interactions: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .innerJoin(offers, eq(offers.id, analyticsEvents.offerId))
    .where(and(sql`${analyticsEvents.type} in ('claim','reveal')`, gte(analyticsEvents.createdAt, since)))
    .groupBy(offers.companyId)
    .having(sql`count(*) >= ${minInteractions}`)
    .orderBy(desc(sql`count(*)`))
    .limit(12);
  return rows;
}
