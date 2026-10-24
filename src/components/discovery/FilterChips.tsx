import { X } from "lucide-react";
import Link from "next/link";
import { clearFilters, filtersHref, type DealFilters } from "@/lib/filters";
import { CUSTOMER_LABEL, OFFER_TYPE_PLURAL, VERIFICATION_LABEL } from "@/lib/labels";

const BILLING_LABEL: Record<string, string> = { month: "Monthly", year: "Annual", one_time: "One-time", week: "Weekly", day: "Daily" };
const PLATFORM_LABEL: Record<string, string> = { web: "Web", windows: "Windows", macos: "macOS", linux: "Linux", ios: "iOS", android: "Android" };

export interface Chip {
  key: string;
  label: string;
  href: string;
}

export function buildChips(
  path: string,
  f: DealFilters,
  fixed: Partial<DealFilters>,
  names: { categories: Map<string, string>; companies: Map<string, string> },
): Chip[] {
  const base = { ...f, page: 1 };
  const chips: Chip[] = [];
  const remove = (patch: Partial<DealFilters>) => filtersHref(path, { ...base, ...patch });
  if (f.q) chips.push({ key: "q", label: `“${f.q}”`, href: remove({ q: "" }) });
  if (!fixed.categories)
    f.categories.forEach((c) => chips.push({ key: `category-${c}`, label: names.categories.get(c) ?? c, href: remove({ categories: f.categories.filter((x) => x !== c) }) }));
  if (!fixed.types) f.types.forEach((t) => chips.push({ key: `type-${t}`, label: OFFER_TYPE_PLURAL[t], href: remove({ types: f.types.filter((x) => x !== t) }) }));
  f.verification.forEach((v) => chips.push({ key: `ver-${v}`, label: VERIFICATION_LABEL[v].label, href: remove({ verification: f.verification.filter((x) => x !== v) }) }));
  f.billing.forEach((b) => chips.push({ key: `bill-${b}`, label: BILLING_LABEL[b], href: remove({ billing: f.billing.filter((x) => x !== b) }) }));
  f.customer.forEach((c) => chips.push({ key: `cust-${c}`, label: CUSTOMER_LABEL[c], href: remove({ customer: f.customer.filter((x) => x !== c) }) }));
  f.platforms.forEach((p) => chips.push({ key: `plat-${p}`, label: PLATFORM_LABEL[p], href: remove({ platforms: f.platforms.filter((x) => x !== p) }) }));
  f.companies.forEach((c) => chips.push({ key: `co-${c}`, label: names.companies.get(c) ?? c, href: remove({ companies: f.companies.filter((x) => x !== c) }) }));
  if (f.student && !fixed.student) chips.push({ key: "student", label: f.student === "only" ? "Student offers only" : "No student-only offers", href: remove({ student: null }) });
  if (f.free) chips.push({ key: "free", label: "Free only", href: remove({ free: false }) });
  if (f.minDiscount != null) chips.push({ key: "min", label: `≥ ${f.minDiscount}% discount`, href: remove({ minDiscount: null }) });
  if (f.maxPrice != null) chips.push({ key: "max", label: `≤ ${f.maxPrice} ${f.currency ?? "USD"}`, href: remove({ maxPrice: null, currency: null }) });
  if (f.endsWithin != null) chips.push({ key: "ends", label: `Ends within ${f.endsWithin} days`, href: remove({ endsWithin: null }) });
  if (f.eligibleOnly) chips.push({ key: "elig", label: "Confirmed for my country", href: remove({ eligibleOnly: false }) });
  if (f.includeRestricted) chips.push({ key: "restr", label: "Including unavailable in my country", href: remove({ includeRestricted: false }) });
  if (f.includeExpired) chips.push({ key: "exp", label: "Including expired", href: remove({ includeExpired: false }) });
  return chips;
}

export default function FilterChips({ chips, clearHref }: { chips: Chip[]; clearHref: string }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              scroll={false}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface-2 pl-3 pr-2 text-xs text-fg hover:border-line-strong"
              aria-label={`Remove filter: ${chip.label}`}
            >
              {chip.label}
              <X className="size-3.5 text-subtle" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={clearHref} scroll={false} className="text-xs font-medium text-link underline-offset-4 hover:underline">
        Clear all
      </Link>
    </div>
  );
}

export function clearAllHref(path: string, f: DealFilters, fixed: Partial<DealFilters>) {
  return filtersHref(path, { ...clearFilters(f, fixed), q: "" }, { types: !!fixed.types, categories: !!fixed.categories, student: !!fixed.student });
}
