/**
 * Everything the public offer page shows: decisions, pricing table, eligibility, evidence,
 * history and alternatives.
 */
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { countryName, REGION_GROUPS } from "@/lib/countries";
import { db } from "../db";
import {
  offerCategories,
  offerRevisions,
  offerSources,
  offers,
  pricePoints,
  sourceObservations,
  sources,
  verificationRecords,
} from "../db/schema";
import { loadBundles, publicOfferWhere, type OfferBundle } from "./bundles";
import { decideOffer, toCardView, type OfferCardView, type OfferDecision } from "./offer-view";

export interface OfferDetail {
  bundle: OfferBundle;
  decision: OfferDecision;
  card: OfferCardView;
  sources: {
    id: string;
    url: string;
    title: string;
    sourceType: (typeof sources.$inferSelect)["sourceType"];
    isOfficial: boolean;
    role: string;
    firstDiscoveredAt: Date;
    lastCheckedAt: Date | null;
    lastSuccessAt: Date | null;
    lastOutcome: (typeof sources.$inferSelect)["lastOutcome"];
  }[];
  verifications: (typeof verificationRecords.$inferSelect)[];
  revisions: (typeof offerRevisions.$inferSelect)[];
  priceHistory: (typeof pricePoints.$inferSelect)[];
  observationPeriod: { firstObservedAt: Date | null; lastObservedAt: Date | null; checks: number; failedChecks: number; longestGapDays: number | null };
  ruleGroups: { status: string; places: string[] }[];
  related: OfferCardView[];
  isArchived: boolean;
}

export async function getOfferDetail(slug: string, country: string | null, now: Date = new Date()): Promise<OfferDetail | null> {
  const [row] = await db
    .select()
    .from(offers)
    .where(and(eq(offers.slug, slug), publicOfferWhere({ includeExpired: true, includeArchived: true })))
    .limit(1);
  if (!row) return null;
  const [bundle] = await loadBundles([row]);
  const decision = decideOffer(bundle, { country, now });

  const [sourceRows, verifications, revisions, priceHistory, observations, related] = await Promise.all([
    db
      .select({
        id: sources.id,
        url: sources.url,
        title: sources.title,
        sourceType: sources.sourceType,
        isOfficial: sources.isOfficial,
        role: offerSources.role,
        firstDiscoveredAt: sources.firstDiscoveredAt,
        lastCheckedAt: sources.lastCheckedAt,
        lastSuccessAt: sources.lastSuccessAt,
        lastOutcome: sources.lastOutcome,
      })
      .from(offerSources)
      .innerJoin(sources, eq(sources.id, offerSources.sourceId))
      .where(eq(offerSources.offerId, row.id))
      .orderBy(desc(sources.isOfficial), asc(sources.firstDiscoveredAt)),
    db.select().from(verificationRecords).where(eq(verificationRecords.offerId, row.id)).orderBy(desc(verificationRecords.verifiedAt)).limit(20),
    db.select().from(offerRevisions).where(eq(offerRevisions.offerId, row.id)).orderBy(desc(offerRevisions.changedAt)).limit(30),
    db
      .select()
      .from(pricePoints)
      .where(row.planId ? sql`${pricePoints.offerId} = ${row.id} or ${pricePoints.planId} = ${row.planId}` : eq(pricePoints.offerId, row.id))
      .orderBy(desc(pricePoints.observedAt))
      .limit(50),
    db
      .select({ observedAt: sourceObservations.observedAt, outcome: sourceObservations.outcome })
      .from(sourceObservations)
      .where(eq(sourceObservations.offerId, row.id))
      .orderBy(asc(sourceObservations.observedAt)),
    relatedOffers(bundle, country, now),
  ]);

  return {
    bundle,
    decision,
    card: toCardView(bundle, decision),
    sources: sourceRows,
    verifications,
    revisions,
    priceHistory,
    observationPeriod: observationPeriod(observations),
    ruleGroups: groupRules(bundle),
    related,
    isArchived: row.publicationStatus === "archived",
  };
}

function observationPeriod(obs: { observedAt: Date; outcome: string }[]) {
  if (!obs.length) return { firstObservedAt: null, lastObservedAt: null, checks: 0, failedChecks: 0, longestGapDays: null };
  let longestGap = 0;
  for (let i = 1; i < obs.length; i++) {
    longestGap = Math.max(longestGap, obs[i].observedAt.getTime() - obs[i - 1].observedAt.getTime());
  }
  const failed = obs.filter((o) => !["ok", "changed", "markers_missing", "redirected"].includes(o.outcome)).length;
  return {
    firstObservedAt: obs[0].observedAt,
    lastObservedAt: obs[obs.length - 1].observedAt,
    checks: obs.length,
    failedChecks: failed,
    longestGapDays: obs.length > 1 ? Math.round(longestGap / 86_400_000) : null,
  };
}

const RULE_ORDER = ["confirmed_eligible", "likely_eligible", "unknown", "confirmed_ineligible"];

function groupRules(bundle: OfferBundle): { status: string; places: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const r of bundle.rules) {
    const place =
      r.scope === "global" ? "All countries" : r.scope === "region" ? (REGION_GROUPS[r.regionCode ?? ""]?.name ?? r.regionCode ?? "") : countryName(r.countryCode);
    groups.set(r.status, [...(groups.get(r.status) ?? []), place]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => RULE_ORDER.indexOf(a) - RULE_ORDER.indexOf(b))
    .map(([status, places]) => ({ status, places: places.sort() }));
}

async function relatedOffers(bundle: OfferBundle, country: string | null, now: Date): Promise<OfferCardView[]> {
  const categoryIds = bundle.categories.map((c) => c.id);
  const sameCompany = await db
    .select()
    .from(offers)
    .where(and(publicOfferWhere(), eq(offers.companyId, bundle.offer.companyId), ne(offers.id, bundle.offer.id)))
    .limit(4);
  const sameCategory = categoryIds.length
    ? await db
        .select({ offer: offers })
        .from(offers)
        .innerJoin(offerCategories, eq(offerCategories.offerId, offers.id))
        .where(
          and(publicOfferWhere(), inArray(offerCategories.categoryId, categoryIds), ne(offers.companyId, bundle.offer.companyId)),
        )
        .orderBy(desc(offers.verifiedAt))
        .limit(8)
    : [];
  const seen = new Set<string>();
  const rows = [...sameCompany, ...sameCategory.map((r) => r.offer)].filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, 6);
  const bundles = await loadBundles(rows);
  return bundles
    .map((b) => ({ b, d: decideOffer(b, { country, now }) }))
    .filter(({ d }) => d.country.status !== "confirmed_ineligible")
    .map(({ b, d }) => toCardView(b, d));
}

/** Coupons safe to reveal publicly for an offer (codes are not part of the page HTML until requested). */
export async function getRevealableCoupons(slug: string) {
  const [row] = await db
    .select()
    .from(offers)
    .where(and(eq(offers.slug, slug), publicOfferWhere({ includeExpired: true })))
    .limit(1);
  if (!row) return null;
  const [bundle] = await loadBundles([row]);
  return {
    offerId: row.id,
    coupons: bundle.coupons
      .filter((c) => c.status !== "invalid")
      .map((c) => ({
        id: c.id,
        code: c.code,
        status: c.status,
        description: c.description,
        lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
        testCountry: c.testCountry,
      })),
  };
}
