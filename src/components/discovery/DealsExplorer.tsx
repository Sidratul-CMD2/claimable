import { asc, eq, inArray } from "drizzle-orm";
import { EyeOff, SearchX } from "lucide-react";
import Link from "next/link";
import CountrySelector from "@/components/layout/CountrySelector";
import OfferCard from "@/components/offers/OfferCard";
import { countryName } from "@/lib/countries";
import { activeFilterCount, filtersHref, parseFilters, type DealFilters } from "@/lib/filters";
import { pluralize } from "@/lib/format";
import { db } from "@/server/db";
import { categories, companies, offers } from "@/server/db/schema";
import { resolveCountry } from "@/server/request-context";
import { publicOfferWhere } from "@/server/services/bundles";
import { recordEvent } from "@/server/services/analytics";
import { searchOffers } from "@/server/services/search";
import CategoryNav from "./CategoryNav";
import FilterChips, { buildChips, clearAllHref } from "./FilterChips";
import FilterDrawer from "./FilterDrawer";
import FilterForm from "./FilterForm";
import Pagination from "./Pagination";
import ResultsToolbar from "./ResultsToolbar";

export interface ExplorerProps {
  path: string;
  searchParams: Record<string, string | string[] | undefined>;
  fixed?: Partial<DealFilters>;
  heading: string;
  intro?: React.ReactNode;
  navActive: string;
  /** Extra content above the results (e.g. student guidance). */
  children?: React.ReactNode;
}

export default async function DealsExplorer({ path, searchParams, fixed = {}, heading, intro, navActive, children }: ExplorerProps) {
  const parsed = parseFilters(searchParams);
  const filters: DealFilters = { ...parsed, ...fixed };
  const country = await resolveCountry(filters.country);

  const [categoryRows, companyRows, result] = await Promise.all([
    db.select({ slug: categories.slug, name: categories.name }).from(categories).where(eq(categories.isVisible, true)).orderBy(asc(categories.sortOrder)),
    db
      .selectDistinct({ slug: companies.slug, name: companies.name })
      .from(companies)
      .where(inArray(companies.id, db.select({ id: offers.companyId }).from(offers).where(publicOfferWhere())))
      .orderBy(asc(companies.name)),
    searchOffers({ filters, country }),
  ]);

  if (filters.q && filters.page === 1) {
    await recordEvent({ type: "search", query: filters.q, resultCount: result.total, countryCode: country, path });
  }

  const omit = { types: !!fixed.types, categories: !!fixed.categories, student: !!fixed.student };
  const names = { categories: new Map(categoryRows.map((c) => [c.slug, c.name])), companies: new Map(companyRows.map((c) => [c.slug, c.name])) };
  const chips = buildChips(path, filters, fixed, names);
  const clearHref = clearAllHref(path, filters, fixed);
  const count = activeFilterCount(filters, fixed);
  const formProps = { action: path, filters, fixed, categories: categoryRows, companies: companyRows, country };

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-6 md:px-6 md:pt-10">
      <header className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{heading}</h1>
        {intro ? <div className="mt-2 text-muted">{intro}</div> : null}
      </header>

      {!country ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <p className="flex-1 text-muted">Choose your country to see which offers are confirmed for you. Until then, eligibility is shown as not confirmed.</p>
          <CountrySelector country={null} suggested={null} />
        </div>
      ) : null}

      {children}

      <div className="mt-8 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Browse and filter">
          <div className="sticky top-24 grid max-h-[calc(100dvh-7rem)] gap-6 overflow-y-auto pb-8 pr-2">
            <CategoryNav categories={categoryRows} active={navActive} />
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Filter results</h2>
              <FilterForm {...formProps} idPrefix="desk" mode="sidebar" />
            </div>
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="text-sm text-muted" aria-live="polite">
              <span className="font-semibold text-fg">{pluralize(result.total, "offer")}</span>
              {country ? ` · eligibility shown for ${countryName(country)}` : ""}
            </h2>
            <div className="flex items-center gap-2">
              <FilterDrawer count={count}>
                <FilterForm {...formProps} idPrefix="mob" mode="drawer" />
              </FilterDrawer>
              <ResultsToolbar sort={filters.sort} view={filters.view} />
            </div>
          </div>

          <div className="mt-3">
            <FilterChips chips={chips} clearHref={clearHref} />
          </div>

          {result.hiddenRestricted > 0 && country ? (
            <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
              <EyeOff className="size-4" aria-hidden="true" />
              {pluralize(result.hiddenRestricted, "offer")} confirmed as not available in {countryName(country)} {result.hiddenRestricted === 1 ? "is" : "are"} hidden.
              <Link href={filtersHref(path, { ...filters, includeRestricted: true, page: 1 }, omit)} scroll={false} className="text-link">
                Show {result.hiddenRestricted === 1 ? "it" : "them"}
              </Link>
            </p>
          ) : null}

          {result.items.length ? (
            <ul className={`mt-6 grid gap-4 ${filters.view === "list" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
              {result.items.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} layout={filters.view} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyResults filters={filters} count={count} clearHref={clearHref} suggestions={result.suggestions} categories={categoryRows} country={country} />
          )}

          <Pagination path={path} filters={filters} page={result.page} pageCount={result.pageCount} omit={omit} />
        </section>
      </div>
    </div>
  );
}

function EmptyResults({
  filters,
  count,
  clearHref,
  suggestions,
  categories,
  country,
}: {
  filters: DealFilters;
  count: number;
  clearHref: string;
  suggestions: { label: string; href: string }[];
  categories: { slug: string; name: string }[];
  country: string | null;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center">
      <SearchX className="mx-auto size-8 text-subtle" aria-hidden="true" />
      <h3 className="mt-3 font-display text-xl font-semibold">
        {filters.q ? `No offers match “${filters.q}”` : "No offers match these filters"}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        {count > 0
          ? "One or more filters exclude every offer we currently track. Remove a filter or clear them all."
          : filters.q
            ? "We only list offers we have evidence for, so some software has no current deal here."
            : "There are no published offers in this view yet. We do not fill empty pages with unverified deals."}
        {country && !filters.includeRestricted ? ` Offers confirmed as unavailable in ${countryName(country)} are hidden.` : ""}
      </p>
      {suggestions.length ? (
        <p className="mt-4 text-sm">
          Did you mean{" "}
          {suggestions.map((s, i) => (
            <span key={s.href}>
              {i > 0 ? ", " : ""}
              <Link href={s.href} className="text-link">
                {s.label}
              </Link>
            </span>
          ))}
          ?
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {count > 0 || filters.q ? (
          <Link href={clearHref} className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-[var(--ink-on-light)]">
            Clear all filters
          </Link>
        ) : null}
        <Link href="/calendar" className="rounded-full border border-line px-4 py-2 text-sm hover:border-line-strong">
          See past and upcoming promotions
        </Link>
      </div>
      <p className="mt-6 text-xs text-subtle">Related categories</p>
      <ul className="mt-2 flex flex-wrap justify-center gap-2">
        {categories.slice(0, 6).map((c) => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`} className="text-sm text-link">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
