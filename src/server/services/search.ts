/**
 * Discovery search: SQL narrows candidates (text + structural filters), domain code decides
 * eligibility, verification and ranking. See docs/ARCHITECTURE.md for the scaling note.
 */
import { and, desc, eq, gt, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { DealFilters } from "@/lib/filters";
import { db } from "../db";
import { categories, companies, offerCategories, offers } from "../db/schema";
import { rankOffers, type SortKey } from "../domain/ranking";
import { loadBundles, publicOfferWhere, type OfferBundle } from "./bundles";
import { decideOffer, toCardView, toRankable, type OfferCardView, type OfferDecision } from "./offer-view";

export const PAGE_SIZE = 24;

/** Lowercase, accent-free text used for search indexing and queries. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%$.+#@-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchText(parts: {
  companyName: string;
  productName?: string | null;
  planName?: string | null;
  title: string;
  benefit: string;
  summary?: string | null;
  offerTypeLabel: string;
  categoryNames: string[];
  couponCodes: string[];
  studentProvider?: string | null;
}): string {
  return normalizeSearchText(
    [
      parts.companyName,
      parts.productName,
      parts.planName,
      parts.title,
      parts.benefit,
      parts.summary,
      parts.offerTypeLabel,
      parts.offerTypeLabel === "Student offer" ? "student students education academic" : "",
      parts.categoryNames.join(" "),
      parts.couponCodes.join(" "),
      parts.studentProvider,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export interface SearchResult {
  items: OfferCardView[];
  total: number;
  page: number;
  pageCount: number;
  /** Offers hidden because they are confirmed unavailable in the selected country. */
  hiddenRestricted: number;
  /** "Did you mean" suggestions when nothing matched. */
  suggestions: { label: string; href: string }[];
}

export interface SearchOptions {
  filters: DealFilters;
  country: string | null;
  now?: Date;
  pageSize?: number;
}

function textCondition(q: string): { where: SQL; score: SQL<number> } {
  const term = normalizeSearchText(q);
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return {
    where: or(
      sql`${offers.searchText} ilike ${like}`,
      sql`word_similarity(${term}, ${offers.searchText}) >= 0.32`,
      sql`to_tsvector('simple', ${offers.searchText}) @@ websearch_to_tsquery('simple', ${term})`,
    )!,
    score: sql<number>`greatest(
      case when ${offers.searchText} ilike ${like} then 1.0 else 0 end,
      word_similarity(${term}, ${offers.searchText}),
      ts_rank(to_tsvector('simple', ${offers.searchText}), websearch_to_tsquery('simple', ${term}))
    )`,
  };
}

function structuralConditions(f: DealFilters, now: Date): SQL[] {
  const c: SQL[] = [];
  if (f.types.length) c.push(inArray(offers.offerType, f.types));
  if (f.categories.length) {
    c.push(
      inArray(
        offers.id,
        db
          .select({ id: offerCategories.offerId })
          .from(offerCategories)
          .innerJoin(categories, eq(categories.id, offerCategories.categoryId))
          .where(inArray(categories.slug, f.categories)),
      ),
    );
  }
  if (f.companies.length) {
    c.push(inArray(offers.companyId, db.select({ id: companies.id }).from(companies).where(inArray(companies.slug, f.companies))));
  }
  if (f.student === "only") c.push(or(eq(offers.studentRequired, true), eq(offers.offerType, "student"))!);
  if (f.student === "exclude") c.push(and(eq(offers.studentRequired, false), sql`${offers.offerType} <> 'student'`)!);
  if (f.customer.length) c.push(inArray(offers.customerEligibility, f.customer));
  if (f.billing.length) {
    const parts: SQL[] = [inArray(offers.promoInterval, f.billing)];
    if (f.billing.includes("one_time")) parts.push(eq(offers.offerType, "lifetime"));
    c.push(or(...parts)!);
  }
  if (f.platforms.length) {
    c.push(sql`${offers.platforms} && ARRAY[${sql.join(
      f.platforms.map((p) => sql`${p}`),
      sql`, `,
    )}]::text[]`);
  }
  if (f.endsWithin) {
    c.push(eq(offers.endsAtConfirmed, true), gt(offers.endsAt, now), lte(offers.endsAt, new Date(now.getTime() + f.endsWithin * 86_400_000)));
  }
  if (f.free) c.push(or(eq(offers.promoPriceMinor, 0), and(eq(offers.offerType, "free_trial"), gt(offers.trialDays, 0)))!);
  if (f.maxPrice != null) {
    c.push(lte(offers.promoPriceMinor, f.maxPrice * 100), eq(offers.currency, f.currency ?? "USD"), gte(offers.promoPriceMinor, 0));
  }
  return c;
}

export interface DecidedOffer {
  bundle: OfferBundle;
  decision: OfferDecision;
  textScore: number;
}

/** Applies post-decision filters (country, verification, discount) shared by every listing. */
export function applyDecisionFilters(list: DecidedOffer[], f: DealFilters): { kept: DecidedOffer[]; hiddenRestricted: number } {
  let hiddenRestricted = 0;
  const kept = list.filter(({ bundle, decision }) => {
    const status = decision.country.status;
    if (status === "confirmed_ineligible" && !f.includeRestricted) {
      hiddenRestricted++;
      return false;
    }
    if (f.eligibleOnly && status !== "confirmed_eligible") return false;
    if (f.verification.length && !f.verification.includes(decision.verification.state)) return false;
    if (f.minDiscount != null) {
      const percent = decision.savings.savings?.percent ?? bundle.offer.advertisedDiscountPercent;
      if (percent == null || percent < f.minDiscount) return false;
    }
    return true;
  });
  return { kept, hiddenRestricted };
}

export async function searchOffers({ filters, country, now = new Date(), pageSize = PAGE_SIZE }: SearchOptions): Promise<SearchResult> {
  const conditions: SQL[] = [publicOfferWhere({ includeExpired: filters.includeExpired }), ...structuralConditions(filters, now)];
  const text = filters.q ? textCondition(filters.q) : null;
  if (text) conditions.push(text.where);

  const rows = await db
    .select({ offer: offers, score: text ? text.score : sql<number>`0` })
    .from(offers)
    .where(and(...conditions))
    .orderBy(desc(offers.publishedAt))
    .limit(2000);

  const scores = new Map(rows.map((r) => [r.offer.id, Number(r.score) || 0]));
  const bundles = await loadBundles(rows.map((r) => r.offer));
  const decided: DecidedOffer[] = bundles.map((bundle) => ({
    bundle,
    decision: decideOffer(bundle, { country, now }),
    textScore: scores.get(bundle.offer.id) ?? 0,
  }));
  const { kept, hiddenRestricted } = applyDecisionFilters(decided, filters);

  const ranked = rankOffers(
    kept.map((d) => ({ ...toRankable(d.bundle, d.decision, d.textScore), entry: d })),
    filters.sort as SortKey,
    { hasQuery: !!filters.q, now },
  );
  const total = ranked.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pageCount);
  const items = ranked.slice((page - 1) * pageSize, page * pageSize).map((r) => toCardView(r.entry.bundle, r.entry.decision));

  const suggestions = total === 0 && filters.q ? await didYouMean(filters.q) : [];
  return { items, total, page, pageCount, hiddenRestricted, suggestions };
}

/** Closest company and category names for a query with no results. */
export async function didYouMean(q: string): Promise<{ label: string; href: string }[]> {
  const term = normalizeSearchText(q);
  if (!term) return [];
  const [companyRows, categoryRows] = await Promise.all([
    db
      .select({ name: companies.name, slug: companies.slug, sim: sql<number>`similarity(lower(${companies.name}), ${term})` })
      .from(companies)
      .where(and(sql`similarity(lower(${companies.name}), ${term}) > 0.2`, eq(companies.isFixture, false)))
      .orderBy(sql`similarity(lower(${companies.name}), ${term}) desc`)
      .limit(3),
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.isVisible, true), sql`similarity(lower(${categories.name}), ${term}) > 0.2`))
      .limit(2),
  ]);
  return [
    ...companyRows.map((c) => ({ label: c.name, href: `/companies/${c.slug}` })),
    ...categoryRows.map((c) => ({ label: c.name, href: `/categories/${c.slug}` })),
  ];
}

export interface Suggestion {
  type: "company" | "offer" | "category";
  label: string;
  detail: string;
  href: string;
}

/** Autocomplete for the header search box. */
export async function suggest(q: string): Promise<Suggestion[]> {
  const term = normalizeSearchText(q);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const [companyRows, offerRows, categoryRows] = await Promise.all([
    db
      .select({ name: companies.name, slug: companies.slug })
      .from(companies)
      .where(
        and(
          or(sql`lower(${companies.name}) like ${like}`, sql`word_similarity(${term}, lower(${companies.name})) > 0.4`),
          inArray(companies.id, db.select({ id: offers.companyId }).from(offers).where(publicOfferWhere())),
        ),
      )
      .orderBy(sql`word_similarity(${term}, lower(${companies.name})) desc`)
      .limit(4),
    db
      .select({ title: offers.title, slug: offers.slug, benefit: offers.benefit })
      .from(offers)
      .where(and(publicOfferWhere(), or(sql`${offers.searchText} ilike ${like}`, sql`word_similarity(${term}, ${offers.searchText}) >= 0.4`)))
      .orderBy(sql`word_similarity(${term}, ${offers.searchText}) desc`)
      .limit(5),
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.isVisible, true), or(sql`lower(${categories.name}) like ${like}`, sql`word_similarity(${term}, lower(${categories.name})) > 0.4`)))
      .limit(2),
  ]);
  return [
    ...companyRows.map((c) => ({ type: "company" as const, label: c.name, detail: "Company", href: `/companies/${c.slug}` })),
    ...categoryRows.map((c) => ({ type: "category" as const, label: c.name, detail: "Category", href: `/categories/${c.slug}` })),
    ...offerRows.map((o) => ({ type: "offer" as const, label: o.title, detail: o.benefit, href: `/deals/${o.slug}` })),
  ];
}
