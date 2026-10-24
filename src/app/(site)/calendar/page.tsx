import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import CalendarViewToggle from "@/components/calendar/CalendarViewToggle";
import { formatDate } from "@/lib/format";
import { OCCASION_LABEL } from "@/lib/labels";
import { getCalendar, monthGrid, type CalendarEvent } from "@/server/services/calendar";

export const metadata: Metadata = {
  title: "Deals calendar",
  description: "Confirmed upcoming software sales, previously observed promotions, and evidence-based predicted windows — clearly labelled.",
  alternates: { canonical: "/calendar" },
};

const KIND_STYLE: Record<CalendarEvent["kind"], { label: string; className: string; dot: string }> = {
  confirmed: { label: "Confirmed", className: "border-[var(--positive)]/50 bg-[var(--positive-bg)]", dot: "bg-[var(--positive)]" },
  historical: { label: "Historical", className: "border-line bg-surface-2", dot: "bg-[var(--neutral)]" },
  predicted: { label: "Predicted — not announced", className: "border-dashed border-[var(--accent)]/70 bg-transparent", dot: "border border-dashed border-[var(--accent)]" },
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = params.view === "upcoming" || params.view === "history" ? params.view : "month";
  const now = new Date();
  const monthParam = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : now.toISOString().slice(0, 7);
  const [year, monthNum] = monthParam.split("-").map(Number);
  const { events, withheld, companyOptions, categoryOptions } = await getCalendar({ company: params.company, category: params.category }, now);

  const keep = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    const qs = next.toString();
    return qs ? `/calendar?${qs}` : "/calendar";
  };
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
  };
  const monthLabel = new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const weeks = monthGrid(year, monthNum - 1);
  const monthStart = `${monthParam}-01`;
  const monthEnd = weeks.flat().filter(Boolean).at(-1)!;
  const inMonth = events.filter((e) => e.startsOn <= monthEnd && e.endsOn >= monthStart);
  const upcoming = events.filter((e) => e.timing !== "past" && e.kind !== "historical");
  const history = events.filter((e) => e.kind === "historical").reverse();
  const today = now.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-6 md:px-6 md:pt-10">
      <header className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Deals calendar</h1>
        <p className="mt-2 text-muted">
          When companies have run promotions, and when they have announced the next one. Predicted windows are estimates from at least two years of recorded history — never confirmed sale dates.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <Suspense>
          <CalendarViewToggle view={view} />
        </Suspense>
        <Form action="/calendar" className="flex flex-wrap items-end gap-2">
          {view !== "month" ? <input type="hidden" name="view" value={view} /> : null}
          {params.month ? <input type="hidden" name="month" value={params.month} /> : null}
          <label className="grid gap-1 text-xs text-muted">
            Company
            <select name="company" defaultValue={params.company ?? ""} className="h-10 rounded-full border border-line bg-surface-2 px-3 text-sm text-fg">
              <option value="">All companies</option>
              {companyOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Category
            <select name="category" defaultValue={params.category ?? ""} className="h-10 rounded-full border border-line bg-surface-2 px-3 text-sm text-fg">
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-full border border-line-strong px-4 text-sm hover:bg-surface-3">
            Apply
          </button>
          {params.company || params.category ? (
            <Link href={keep({ company: null, category: null })} className="h-10 px-2 text-sm leading-10 text-link">
              Clear
            </Link>
          ) : null}
        </Form>
      </div>

      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
        {(Object.keys(KIND_STYLE) as CalendarEvent["kind"][]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${KIND_STYLE[k].dot}`} />
            {KIND_STYLE[k].label}
          </li>
        ))}
      </ul>

      {view === "month" ? (
        <section aria-labelledby="month-heading" className="mt-6">
          <div className="flex items-center justify-between">
            <h2 id="month-heading" className="font-display text-xl font-semibold">
              {monthLabel}
            </h2>
            <nav aria-label="Month" className="flex gap-2 text-sm">
              <Link href={keep({ month: shift(-1) })} className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">
                ← Previous
              </Link>
              <Link href={keep({ month: null })} className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">
                Today
              </Link>
              <Link href={keep({ month: shift(1) })} className="rounded-full border border-line px-3 py-1.5 hover:border-line-strong">
                Next →
              </Link>
            </nav>
          </div>
          {/* Grid on larger screens; an agenda list on phones. */}
          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line md:block" role="table" aria-label={`${monthLabel} calendar`}>
            <div role="row" className="grid grid-cols-7 border-b border-line bg-surface text-xs text-subtle">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div role="columnheader" key={d} className="px-2 py-2 font-medium">
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div role="row" key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
                {week.map((day, di) => {
                  const dayEvents = day ? inMonth.filter((e) => e.startsOn <= day && e.endsOn >= day) : [];
                  return (
                    <div role="cell" key={di} className={`min-h-28 border-r border-line p-1.5 last:border-r-0 ${day ? "" : "bg-raised"} ${day === today ? "bg-[rgb(76_194_233/0.06)]" : ""}`}>
                      {day ? <p className={`text-xs ${day === today ? "font-semibold text-fg" : "text-subtle"}`}>{Number(day.slice(8))}</p> : null}
                      <ul className="mt-1 grid gap-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <li key={e.id} className={`truncate rounded-md border px-1.5 py-0.5 text-[11px] ${KIND_STYLE[e.kind].className}`} title={`${KIND_STYLE[e.kind].label}: ${e.companyName} — ${e.title}`}>
                            <span className="sr-only">{KIND_STYLE[e.kind].label}: </span>
                            {e.companyName}
                          </li>
                        ))}
                        {dayEvents.length > 3 ? <li className="text-[11px] text-muted">+{dayEvents.length - 3} more</li> : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <EventList events={inMonth} empty={`No recorded or announced promotions overlap ${monthLabel}.`} className="mt-4 md:mt-8" />
        </section>
      ) : null}

      {view === "upcoming" ? (
        <section aria-labelledby="upcoming-heading" className="mt-6">
          <h2 id="upcoming-heading" className="font-display text-xl font-semibold">
            Upcoming and ongoing
          </h2>
          <EventList events={upcoming} empty="No announced or predicted promotions are coming up." className="mt-4" />
        </section>
      ) : null}

      {view === "history" ? (
        <section aria-labelledby="history-heading" className="mt-6">
          <h2 id="history-heading" className="font-display text-xl font-semibold">
            Previously observed promotions
          </h2>
          <EventList events={history} empty="No historical promotions recorded yet." className="mt-4" />
        </section>
      ) : null}

      {withheld.length ? (
        <section aria-labelledby="withheld" className="mt-10 rounded-2xl border border-line bg-surface p-4">
          <h2 id="withheld" className="text-sm font-semibold">
            Predictions withheld
          </h2>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {withheld.map((w) => (
              <li key={`${w.companyId}-${w.occasion}`}>
                {w.companyName} — {OCCASION_LABEL[w.occasion]}: {w.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EventList({ events, empty, className = "" }: { events: CalendarEvent[]; empty: string; className?: string }) {
  if (!events.length) return <p className={`rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted ${className}`}>{empty}</p>;
  return (
    <ol className={`grid gap-2 ${className}`}>
      {events.map((e) => (
        <li key={e.id} className={`rounded-xl border p-3 text-sm ${KIND_STYLE[e.kind].className}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium uppercase tracking-wider ${e.kind === "confirmed" ? "text-positive" : e.kind === "predicted" ? "text-accent" : "text-muted"}`}>{KIND_STYLE[e.kind].label}</span>
            <span className="text-xs text-subtle">{OCCASION_LABEL[e.occasion]}</span>
          </div>
          <p className="mt-1">
            <Link href={`/companies/${e.companySlug}`} className="font-medium hover:underline">
              {e.companyName}
            </Link>{" "}
            — {e.kind === "predicted" ? `around ${formatDate(e.startsOn)} – ${formatDate(e.endsOn)}` : `${formatDate(e.startsOn)}${e.endsOn !== e.startsOn ? ` – ${formatDate(e.endsOn)}` : ""}`}
            {e.datesApproximate && e.kind !== "predicted" ? " (approximate dates)" : ""}
          </p>
          {e.kind !== "predicted" ? <p className="text-xs text-muted">{e.title}</p> : null}
          <p className="text-xs text-muted">{e.evidenceNote}</p>
          {e.sourceUrl ? (
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-link">
              Source
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
