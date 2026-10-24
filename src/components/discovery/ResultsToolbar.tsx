"use client";

import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import JellyRadio from "@/components/effects/JellyRadio";
import { SORT_OPTIONS } from "@/lib/filters";

/** Sort (native select: six options) and grid/list view (JellyRadio: one mutually exclusive choice). */
export default function ResultsToolbar({ sort, view }: { sort: string; view: "grid" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params);
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    if (key === "sort") next.delete("page");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-muted">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={sort}
          onChange={(e) => update("sort", e.target.value, "relevance")}
          className="h-10 rounded-full border border-line bg-surface-2 px-3 text-sm text-fg hover:border-line-strong"
          aria-label="Sort results"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden md:block">
        <JellyRadio
          ariaLabel="Result layout"
          size="sm"
          value={view}
          onChange={(v) => update("view", v, "grid")}
          items={[
            { value: "grid", label: "Grid", icon: <LayoutGrid /> },
            { value: "list", label: "List", icon: <List /> },
          ]}
        />
      </div>
    </div>
  );
}
