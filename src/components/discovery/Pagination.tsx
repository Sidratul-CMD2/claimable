import Link from "next/link";
import { filtersHref, type DealFilters } from "@/lib/filters";

export default function Pagination({ path, filters, page, pageCount, omit }: { path: string; filters: DealFilters; page: number; pageCount: number; omit?: Partial<Record<keyof DealFilters, boolean>> }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => filtersHref(path, { ...filters, page: p }, omit);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className="h-10 rounded-full border border-line px-4 text-sm leading-10 hover:border-line-strong">
          Previous
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-subtle">…</span> : null}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`grid size-10 place-items-center rounded-full text-sm ${p === page ? "bg-fg text-[var(--ink-on-light)]" : "border border-line hover:border-line-strong"}`}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={href(page + 1)} className="h-10 rounded-full border border-line px-4 text-sm leading-10 hover:border-line-strong">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
