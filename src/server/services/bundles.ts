/**
 * Loads offers together with everything the domain rules need (company, plan, rules,
 * coupons, reference price) using a fixed number of batched queries.
 */
import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { CountryRule } from "../domain/eligibility";
import type { ReferencePrice } from "../domain/pricing";
import { db } from "../db";
import {
  categories,
  companies,
  coupons,
  offerCategories,
  offerConditions,
  offerCountryRules,
  offers,
  plans,
  pricePoints,
  products,
} from "../db/schema";

export type OfferRow = typeof offers.$inferSelect;
export type CompanyRow = typeof companies.$inferSelect;
export type CouponRow = typeof coupons.$inferSelect;

export interface OfferBundle {
  offer: OfferRow;
  company: Pick<CompanyRow, "id" | "slug" | "name" | "websiteUrl" | "allowedDomains" | "logoUrl" | "description">;
  product: { id: string; slug: string; name: string; platforms: string[] } | null;
  plan: { id: string; slug: string; name: string; audience: string; officialPricingUrl: string | null } | null;
  categories: { id: string; slug: string; name: string }[];
  rules: (CountryRule & { sourceUrl: string | null })[];
  conditions: { kind: string; description: string }[];
  coupons: CouponRow[];
  reference: (ReferencePrice & { sourceUrl: string | null }) | null;
  /** Every list price observed for the plan, newest first, for display. */
  listPrices: (ReferencePrice & { sourceUrl: string | null })[];
}

/** Fixtures are only visible in development/test with SHOW_FIXTURES=1. */
export function fixturesVisible(): boolean {
  return process.env.SHOW_FIXTURES === "1" && process.env.NODE_ENV !== "production";
}

/** Conditions every public query applies. */
export function publicOfferWhere(opts: { includeExpired?: boolean; includeArchived?: boolean } = {}): SQL {
  const conditions: SQL[] = [isNull(offers.canonicalOfferId)];
  if (opts.includeArchived) {
    conditions.push(inArray(offers.publicationStatus, ["published", "archived"]));
  } else {
    conditions.push(eq(offers.publicationStatus, "published"));
  }
  if (!opts.includeExpired) conditions.push(ne(offers.availability, "expired"));
  if (!fixturesVisible()) conditions.push(eq(offers.isFixture, false));
  return and(...conditions)!;
}

const unique = <T>(values: (T | null | undefined)[]) => [...new Set(values.filter((v): v is T => v != null))];

export async function loadBundles(rows: OfferRow[]): Promise<OfferBundle[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const companyIds = unique(rows.map((r) => r.companyId));
  const productIds = unique(rows.map((r) => r.productId));
  const planIds = unique(rows.map((r) => r.planId));

  const [companyRows, productRows, planRows, categoryRows, ruleRows, conditionRows, couponRows, priceRows] = await Promise.all([
    db
      .select({
        id: companies.id,
        slug: companies.slug,
        name: companies.name,
        websiteUrl: companies.websiteUrl,
        allowedDomains: companies.allowedDomains,
        logoUrl: companies.logoUrl,
        description: companies.description,
      })
      .from(companies)
      .where(inArray(companies.id, companyIds)),
    productIds.length
      ? db
          .select({ id: products.id, slug: products.slug, name: products.name, platforms: products.platforms })
          .from(products)
          .where(inArray(products.id, productIds))
      : Promise.resolve([]),
    planIds.length
      ? db
          .select({ id: plans.id, slug: plans.slug, name: plans.name, audience: plans.audience, officialPricingUrl: plans.officialPricingUrl })
          .from(plans)
          .where(inArray(plans.id, planIds))
      : Promise.resolve([]),
    db
      .select({ offerId: offerCategories.offerId, id: categories.id, slug: categories.slug, name: categories.name })
      .from(offerCategories)
      .innerJoin(categories, eq(categories.id, offerCategories.categoryId))
      .where(inArray(offerCategories.offerId, ids))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(offerCountryRules).where(inArray(offerCountryRules.offerId, ids)),
    db.select().from(offerConditions).where(inArray(offerConditions.offerId, ids)).orderBy(asc(offerConditions.createdAt)),
    db.select().from(coupons).where(inArray(coupons.offerId, ids)).orderBy(asc(coupons.createdAt)),
    planIds.length
      ? db
          .select()
          .from(pricePoints)
          .where(and(inArray(pricePoints.planId, planIds), eq(pricePoints.kind, "list")))
          .orderBy(desc(pricePoints.observedAt))
      : Promise.resolve([]),
  ]);

  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const group = <T, K>(list: T[], key: (x: T) => K) => {
    const map = new Map<K, T[]>();
    for (const item of list) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
    return map;
  };
  const companyMap = byId(companyRows);
  const productMap = byId(productRows);
  const planMap = byId(planRows);
  const categoriesByOffer = group(categoryRows, (c) => c.offerId);
  const rulesByOffer = group(ruleRows, (r) => r.offerId);
  const conditionsByOffer = group(conditionRows, (c) => c.offerId);
  const couponsByOffer = group(couponRows, (c) => c.offerId);
  const pricesByPlan = group(priceRows, (p) => p.planId);

  return rows.map((offer) => {
    const listPrices = (offer.planId ? (pricesByPlan.get(offer.planId) ?? []) : []).map((p) => ({
      amountMinor: p.amountMinor,
      currency: p.currency,
      interval: p.interval,
      observedAt: p.observedAt,
      isReliable: p.isReliable,
      sourceUrl: p.sourceUrl,
    }));
    return {
      offer,
      company: companyMap.get(offer.companyId)!,
      product: offer.productId ? (productMap.get(offer.productId) ?? null) : null,
      plan: offer.planId ? (planMap.get(offer.planId) ?? null) : null,
      categories: (categoriesByOffer.get(offer.id) ?? []).map(({ id, slug, name }) => ({ id, slug, name })),
      rules: (rulesByOffer.get(offer.id) ?? []).map((r) => ({
        scope: r.scope,
        countryCode: r.countryCode,
        regionCode: r.regionCode,
        status: r.status,
        note: r.note,
        sourceUrl: r.sourceUrl,
      })),
      conditions: (conditionsByOffer.get(offer.id) ?? []).map((c) => ({ kind: c.kind, description: c.description })),
      coupons: couponsByOffer.get(offer.id) ?? [],
      reference: pickReference(listPrices, offer),
      listPrices,
    };
  });
}

/** Prefers the newest list price matching the offer's currency and promotional interval. */
function pickReference(prices: OfferBundle["listPrices"], offer: OfferRow): OfferBundle["reference"] {
  if (!prices.length) return null;
  const currency = offer.currency?.toUpperCase();
  return (
    prices.find((p) => p.currency === currency && p.interval === offer.promoInterval) ??
    prices.find((p) => p.currency === currency) ??
    prices[0]
  );
}

export async function loadPublicOffers(where?: SQL, opts: { includeExpired?: boolean; limit?: number } = {}): Promise<OfferBundle[]> {
  const rows = await db
    .select()
    .from(offers)
    .where(and(publicOfferWhere({ includeExpired: opts.includeExpired }), where ?? sql`true`))
    .orderBy(desc(offers.publishedAt))
    .limit(opts.limit ?? 2000);
  return loadBundles(rows);
}
