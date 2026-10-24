/** Public company directory and company pages. */
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { categories, companies, companyCategories, offers, plans, pricePoints, products, promotionalEvents } from "../db/schema";
import { predictWindows } from "../domain/calendar";
import { pickBestOffer } from "../domain/ranking";
import { fixturesVisible, loadBundles, publicOfferWhere } from "./bundles";
import { decideOffer, toCardView } from "./offer-view";

export async function listCompanies() {
  const rows = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      name: companies.name,
      description: companies.description,
      active: sql<number>`count(${offers.id}) filter (where ${offers.availability} <> 'expired')::int`,
    })
    .from(companies)
    .innerJoin(offers, and(eq(offers.companyId, companies.id), publicOfferWhere({ includeExpired: true })))
    .groupBy(companies.id)
    .orderBy(asc(companies.name));
  const cats = rows.length
    ? await db
        .select({ companyId: companyCategories.companyId, name: categories.name, slug: categories.slug })
        .from(companyCategories)
        .innerJoin(categories, eq(categories.id, companyCategories.categoryId))
        .where(inArray(companyCategories.companyId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({ ...r, categories: cats.filter((c) => c.companyId === r.id) }));
}

export async function getCompanyPage(slug: string, country: string | null, now: Date = new Date()) {
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  if (!company || (company.isFixture && !fixturesVisible())) return null;

  const [offerRows, cats, productRows, eventRows] = await Promise.all([
    db.select().from(offers).where(and(eq(offers.companyId, company.id), publicOfferWhere({ includeExpired: true, includeArchived: true }))).orderBy(desc(offers.publishedAt)),
    db
      .select({ id: categories.id, slug: categories.slug, name: categories.name })
      .from(companyCategories)
      .innerJoin(categories, eq(categories.id, companyCategories.categoryId))
      .where(eq(companyCategories.companyId, company.id)),
    db.select().from(products).where(eq(products.companyId, company.id)).orderBy(asc(products.name)),
    db.select().from(promotionalEvents).where(and(eq(promotionalEvents.companyId, company.id), eq(promotionalEvents.isPublished, true))).orderBy(desc(promotionalEvents.startsOn)),
  ]);
  if (!offerRows.length && !eventRows.length) return null;

  const bundles = await loadBundles(offerRows);
  const decided = bundles.map((b) => ({ b, d: decideOffer(b, { country, now }) }));
  const current = decided.filter(({ b }) => b.offer.availability !== "expired" && b.offer.publicationStatus === "published");
  const past = decided.filter(({ b }) => b.offer.availability === "expired" || b.offer.publicationStatus === "archived");

  const best = pickBestOffer(
    current.map(({ b, d }) => ({
      id: b.offer.id,
      planId: b.offer.planId,
      currency: b.offer.currency,
      countryStatus: d.country.status,
      availability: b.offer.availability,
      first12MonthsMinor: d.projection.first12Months?.amountMinor ?? null,
    })),
  );

  const planRows = productRows.length ? await db.select().from(plans).where(inArray(plans.productId, productRows.map((p) => p.id))).orderBy(asc(plans.name)) : [];
  const prices = planRows.length
    ? await db.select().from(pricePoints).where(and(inArray(pricePoints.planId, planRows.map((p) => p.id)), eq(pricePoints.kind, "list"))).orderBy(desc(pricePoints.observedAt))
    : [];

  const { predicted, withheld } = predictWindows(
    eventRows.map((e) => ({ id: e.id, companyId: e.companyId, occasion: e.occasion, kind: e.kind, startsOn: e.startsOn, endsOn: e.endsOn })),
    now,
  );

  const alternatives = cats.length
    ? await db
        .selectDistinct({ slug: companies.slug, name: companies.name })
        .from(companies)
        .innerJoin(companyCategories, eq(companyCategories.companyId, companies.id))
        .innerJoin(offers, and(eq(offers.companyId, companies.id), publicOfferWhere()))
        .where(and(inArray(companyCategories.categoryId, cats.map((c) => c.id)), ne(companies.id, company.id)))
        .limit(8)
    : [];

  return {
    company,
    categories: cats,
    current: current.map(({ b, d }) => toCardView(b, d)),
    past: past.map(({ b, d }) => toCardView(b, d)),
    best,
    pricing: productRows.map((p) => ({
      product: p,
      plans: planRows
        .filter((pl) => pl.productId === p.id)
        .map((pl) => ({ plan: pl, latest: prices.filter((pr) => pr.planId === pl.id).slice(0, 3) })),
    })),
    events: eventRows,
    predicted,
    withheld,
    alternatives,
  };
}
