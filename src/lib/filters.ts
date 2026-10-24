/**
 * Discovery filter state. The URL is the single source of truth so filters survive
 * navigating to an offer and back, can be shared, and work without JavaScript.
 */
import { BILLING_INTERVALS, CUSTOMER_ELIGIBILITIES, OFFER_TYPES, PLATFORMS } from "./enums";
import type { BillingInterval, CustomerEligibility, OfferType, Platform } from "./enums";
import { normalizeCountry } from "./countries";

export const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newly added" },
  { value: "recently_verified", label: "Recently verified" },
  { value: "highest_discount", label: "Highest discount" },
  { value: "lowest_price", label: "Lowest promotional price" },
  { value: "expiring_soon", label: "Expiring soon" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const VERIFICATION_FILTERS = ["officially_confirmed", "redemption_tested", "evidence_supported", "unverified", "stale"] as const;
export type VerificationFilter = (typeof VERIFICATION_FILTERS)[number];

export const ENDS_WITHIN_OPTIONS = [7, 30, 90] as const;

export interface DealFilters {
  q: string;
  /** Explicit country from the URL; when null the visitor's saved country applies. */
  country: string | null;
  categories: string[];
  types: OfferType[];
  verification: VerificationFilter[];
  billing: BillingInterval[];
  customer: CustomerEligibility[];
  student: "only" | "exclude" | null;
  free: boolean;
  minDiscount: number | null;
  maxPrice: number | null;
  currency: string | null;
  platforms: Platform[];
  companies: string[];
  endsWithin: number | null;
  eligibleOnly: boolean;
  includeRestricted: boolean;
  includeExpired: boolean;
  sort: SortValue;
  view: "grid" | "list";
  page: number;
}

export const EMPTY_FILTERS: DealFilters = {
  q: "",
  country: null,
  categories: [],
  types: [],
  verification: [],
  billing: [],
  customer: [],
  student: null,
  free: false,
  minDiscount: null,
  maxPrice: null,
  currency: null,
  platforms: [],
  companies: [],
  endsWithin: null,
  eligibleOnly: false,
  includeRestricted: false,
  includeExpired: false,
  sort: "relevance",
  view: "grid",
  page: 1,
};

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(params: RawParams, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const value = params[key];
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
function getOne(params: RawParams, key: string): string | null {
  return getAll(params, key)[0] ?? null;
}
const slug = (s: string) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s);
function oneOf<T extends string>(values: readonly T[], list: string[]): T[] {
  return [...new Set(list.flatMap((v) => v.split(",")).filter((v): v is T => (values as readonly string[]).includes(v)))];
}
function int(value: string | null, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}
const flag = (value: string | null) => value === "1" || value === "true";

export function parseFilters(params: RawParams): DealFilters {
  const sort = getOne(params, "sort");
  const student = getOne(params, "student");
  const currency = getOne(params, "currency");
  const endsWithin = int(getOne(params, "endsWithin"), 1, 365);
  return {
    q: (getOne(params, "q") ?? "").trim().slice(0, 100),
    country: normalizeCountry(getOne(params, "country")),
    categories: [...new Set(getAll(params, "category").flatMap((v) => v.split(",")).filter(slug))].slice(0, 20),
    types: oneOf(OFFER_TYPES, getAll(params, "type")),
    verification: oneOf(VERIFICATION_FILTERS, getAll(params, "verification")),
    billing: oneOf(BILLING_INTERVALS, getAll(params, "billing")),
    customer: oneOf(CUSTOMER_ELIGIBILITIES, getAll(params, "customer")),
    student: student === "only" || student === "exclude" ? student : null,
    free: flag(getOne(params, "free")),
    minDiscount: int(getOne(params, "minDiscount"), 1, 100),
    maxPrice: int(getOne(params, "maxPrice"), 0, 100_000),
    currency: currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null,
    platforms: oneOf(PLATFORMS, getAll(params, "platform")),
    companies: [...new Set(getAll(params, "company").flatMap((v) => v.split(",")).filter(slug))].slice(0, 20),
    endsWithin: endsWithin && (ENDS_WITHIN_OPTIONS as readonly number[]).includes(endsWithin) ? endsWithin : endsWithin ? 30 : null,
    eligibleOnly: flag(getOne(params, "eligibleOnly")),
    includeRestricted: flag(getOne(params, "restricted")),
    includeExpired: flag(getOne(params, "expired")),
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortValue) : "relevance",
    view: getOne(params, "view") === "list" ? "list" : "grid",
    page: int(getOne(params, "page"), 1, 500) ?? 1,
  };
}

/** Serialises non-default values only, in a stable order. */
export function filtersToParams(f: DealFilters, omit: Partial<Record<keyof DealFilters, boolean>> = {}): URLSearchParams {
  const p = new URLSearchParams();
  const add = (key: keyof DealFilters, name: string, value: string | number | boolean | null | undefined) => {
    if (omit[key] || value == null || value === "" || value === false) return;
    p.append(name, value === true ? "1" : String(value));
  };
  add("q", "q", f.q);
  add("country", "country", f.country);
  if (!omit.categories) f.categories.forEach((v) => p.append("category", v));
  if (!omit.types) f.types.forEach((v) => p.append("type", v));
  if (!omit.verification) f.verification.forEach((v) => p.append("verification", v));
  if (!omit.billing) f.billing.forEach((v) => p.append("billing", v));
  if (!omit.customer) f.customer.forEach((v) => p.append("customer", v));
  add("student", "student", f.student);
  add("free", "free", f.free);
  add("minDiscount", "minDiscount", f.minDiscount);
  add("maxPrice", "maxPrice", f.maxPrice);
  add("currency", "currency", f.maxPrice != null ? f.currency : null);
  if (!omit.platforms) f.platforms.forEach((v) => p.append("platform", v));
  if (!omit.companies) f.companies.forEach((v) => p.append("company", v));
  add("endsWithin", "endsWithin", f.endsWithin);
  add("eligibleOnly", "eligibleOnly", f.eligibleOnly);
  add("includeRestricted", "restricted", f.includeRestricted);
  add("includeExpired", "expired", f.includeExpired);
  add("sort", "sort", f.sort === "relevance" ? null : f.sort);
  add("view", "view", f.view === "grid" ? null : f.view);
  add("page", "page", f.page > 1 ? f.page : null);
  return p;
}

export function filtersHref(pathname: string, f: DealFilters, omit?: Partial<Record<keyof DealFilters, boolean>>): string {
  const qs = filtersToParams(f, omit).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Number of user-chosen narrowing filters (excludes q, sort, view, page and the country). */
export function activeFilterCount(f: DealFilters, fixed: Partial<DealFilters> = {}): number {
  let n = 0;
  if (!fixed.categories) n += f.categories.length;
  if (!fixed.types) n += f.types.length;
  n += f.verification.length + f.billing.length + f.customer.length + f.platforms.length + f.companies.length;
  if (f.student && !fixed.student) n++;
  if (f.free) n++;
  if (f.minDiscount != null) n++;
  if (f.maxPrice != null) n++;
  if (f.endsWithin != null) n++;
  if (f.eligibleOnly) n++;
  if (f.includeRestricted) n++;
  if (f.includeExpired) n++;
  return n;
}

export function clearFilters(f: DealFilters, fixed: Partial<DealFilters> = {}): DealFilters {
  return { ...EMPTY_FILTERS, ...fixed, q: f.q, country: f.country, sort: f.sort, view: f.view };
}
