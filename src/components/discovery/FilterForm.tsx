import Form from "next/form";
import type { DealFilters } from "@/lib/filters";
import { ENDS_WITHIN_OPTIONS, VERIFICATION_FILTERS } from "@/lib/filters";
import { OFFER_TYPE_PLURAL, VERIFICATION_LABEL } from "@/lib/labels";
import { OFFER_TYPES, PLATFORMS } from "@/lib/enums";
import FilterAutoSubmit from "./FilterAutoSubmit";

const PLATFORM_LABEL: Record<string, string> = { web: "Web", windows: "Windows", macos: "macOS", linux: "Linux", ios: "iOS", android: "Android" };
const BILLING = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Annual" },
  { value: "one_time", label: "One-time / lifetime" },
];
const CUSTOMERS = [
  { value: "new_customers", label: "New customers" },
  { value: "existing_customers", label: "Existing customers" },
  { value: "all", label: "New and existing" },
];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];

function Group({ legend, children, defaultOpen = true }: { legend: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-t border-line py-3 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-fg [&::-webkit-details-marker]:hidden">
        {legend}
        <span aria-hidden="true" className="text-subtle transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <fieldset className="mt-2.5 grid gap-1.5">
        <legend className="sr-only">{legend}</legend>
        {children}
      </fieldset>
    </details>
  );
}

function Check({ name, value, checked, label, idPrefix }: { name: string; value: string; checked: boolean; label: string; idPrefix: string }) {
  const id = `${idPrefix}-${name}-${value}`;
  return (
    <label htmlFor={id} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm text-muted hover:text-fg">
      <input id={id} type="checkbox" name={name} value={value} defaultChecked={checked} className="size-4 shrink-0 accent-[var(--orb-cyan)]" />
      {label}
    </label>
  );
}

function Radio({ name, value, checked, label, idPrefix }: { name: string; value: string; checked: boolean; label: string; idPrefix: string }) {
  const id = `${idPrefix}-${name}-${value || "any"}`;
  return (
    <label htmlFor={id} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm text-muted hover:text-fg">
      <input id={id} type="radio" name={name} value={value} defaultChecked={checked} className="size-4 shrink-0 accent-[var(--orb-cyan)]" />
      {label}
    </label>
  );
}

/**
 * Multi-select filters as a GET form (works without JavaScript; next/form adds client-side
 * navigation). The sidebar variant applies on change; the drawer variant applies on "Apply".
 */
export default function FilterForm({
  action,
  filters,
  fixed,
  categories,
  companies,
  country,
  idPrefix,
  mode,
}: {
  action: string;
  filters: DealFilters;
  fixed: Partial<DealFilters>;
  categories: { slug: string; name: string }[];
  companies: { slug: string; name: string }[];
  country: string | null;
  idPrefix: string;
  mode: "sidebar" | "drawer";
}) {
  const formId = `${idPrefix}-filters`;
  return (
    <Form id={formId} action={action} scroll={false} className="grid" aria-label="Filter results">
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.country ? <input type="hidden" name="country" value={filters.country} /> : null}
      {filters.sort !== "relevance" ? <input type="hidden" name="sort" value={filters.sort} /> : null}
      {filters.view !== "grid" ? <input type="hidden" name="view" value={filters.view} /> : null}

      <Group legend="Eligibility">
        <Check name="eligibleOnly" value="1" checked={filters.eligibleOnly} label={country ? "Confirmed for my country only" : "Confirmed for my country (choose a country first)"} idPrefix={idPrefix} />
        <Check name="restricted" value="1" checked={filters.includeRestricted} label="Include offers not available in my country" idPrefix={idPrefix} />
        {!fixed.student && !fixed.types?.includes("student") ? (
          <div className="mt-1 grid gap-0.5" role="radiogroup" aria-label="Student offers">
            <Radio name="student" value="" checked={!filters.student} label="Students and everyone" idPrefix={idPrefix} />
            <Radio name="student" value="only" checked={filters.student === "only"} label="Student offers only" idPrefix={idPrefix} />
            <Radio name="student" value="exclude" checked={filters.student === "exclude"} label="Hide student-only offers" idPrefix={idPrefix} />
          </div>
        ) : null}
      </Group>

      {!fixed.types ? (
        <Group legend="Deal type">
          {OFFER_TYPES.map((t) => (
            <Check key={t} name="type" value={t} checked={filters.types.includes(t)} label={OFFER_TYPE_PLURAL[t]} idPrefix={idPrefix} />
          ))}
        </Group>
      ) : null}

      {!fixed.categories ? (
        <Group legend="Category">
          {categories.map((c) => (
            <Check key={c.slug} name="category" value={c.slug} checked={filters.categories.includes(c.slug)} label={c.name} idPrefix={idPrefix} />
          ))}
        </Group>
      ) : null}

      <Group legend="Verification">
        {VERIFICATION_FILTERS.map((v) => (
          <Check key={v} name="verification" value={v} checked={filters.verification.includes(v)} label={VERIFICATION_LABEL[v].label} idPrefix={idPrefix} />
        ))}
      </Group>

      <Group legend="Price & discount">
        <Check name="free" value="1" checked={filters.free} label="Free offers only" idPrefix={idPrefix} />
        <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
          <label className="grid gap-1 text-xs text-muted">
            Max promotional price
            <input
              type="number"
              name="maxPrice"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={filters.maxPrice ?? ""}
              className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Currency
            <select name="currency" defaultValue={filters.currency ?? "USD"} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-[11px] leading-snug text-subtle">Offers without a disclosed price are excluded while a price limit is set. Currencies are never converted.</p>
        <label className="mt-1 grid gap-1 text-xs text-muted">
          Minimum discount
          <select name="minDiscount" defaultValue={filters.minDiscount ?? ""} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg">
            <option value="">Any</option>
            {[10, 25, 50, 75].map((n) => (
              <option key={n} value={n}>
                {n}% or more
              </option>
            ))}
          </select>
        </label>
      </Group>

      <Group legend="Billing & customers" defaultOpen={false}>
        {BILLING.map((b) => (
          <Check key={b.value} name="billing" value={b.value} checked={filters.billing.includes(b.value as never)} label={b.label} idPrefix={idPrefix} />
        ))}
        <div className="my-1 border-t border-line" />
        {CUSTOMERS.map((c) => (
          <Check key={c.value} name="customer" value={c.value} checked={filters.customer.includes(c.value as never)} label={c.label} idPrefix={idPrefix} />
        ))}
      </Group>

      <Group legend="Dates & platform" defaultOpen={false}>
        <label className="grid gap-1 text-xs text-muted">
          Confirmed to end within
          <select name="endsWithin" defaultValue={filters.endsWithin ?? ""} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg">
            <option value="">Any time (or no end date)</option>
            {ENDS_WITHIN_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
        <Check name="expired" value="1" checked={filters.includeExpired} label="Show expired offers" idPrefix={idPrefix} />
        <div className="my-1 border-t border-line" />
        {PLATFORMS.map((p) => (
          <Check key={p} name="platform" value={p} checked={filters.platforms.includes(p)} label={PLATFORM_LABEL[p]} idPrefix={idPrefix} />
        ))}
      </Group>

      {companies.length ? (
        <Group legend="Company" defaultOpen={filters.companies.length > 0}>
          <div className="grid max-h-56 gap-0.5 overflow-y-auto pr-1">
            {companies.map((c) => (
              <Check key={c.slug} name="company" value={c.slug} checked={filters.companies.includes(c.slug)} label={c.name} idPrefix={idPrefix} />
            ))}
          </div>
        </Group>
      ) : null}

      <div className={`flex gap-2 pt-3 ${mode === "drawer" ? "sticky bottom-0 -mx-4 border-t border-line bg-raised px-4 pb-1" : ""}`}>
        <button
          type="submit"
          className={`h-11 flex-1 rounded-full bg-fg text-sm font-medium text-[var(--ink-on-light)] hover:bg-white ${mode === "sidebar" ? "js-hide-when-auto" : ""}`}
          data-close-drawer={mode === "drawer" ? "" : undefined}
        >
          Apply filters
        </button>
      </div>
      {mode === "sidebar" ? <FilterAutoSubmit formId={formId} /> : null}
    </Form>
  );
}
