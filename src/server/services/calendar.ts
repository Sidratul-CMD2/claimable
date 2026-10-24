/** Deals Calendar read model: stored confirmed/historical events plus computed predictions. */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Occasion } from "@/lib/enums";
import { OCCASION_LABEL } from "@/lib/labels";
import { db } from "../db";
import { categories, companies, companyCategories, promotionalEvents } from "../db/schema";
import { eventTiming, predictWindows, type PredictedWindow, type WithheldPrediction } from "../domain/calendar";
import { fixturesVisible } from "./bundles";

export interface CalendarEvent {
  id: string;
  kind: "confirmed" | "historical" | "predicted";
  title: string;
  occasion: Occasion;
  companyId: string;
  companyName: string;
  companySlug: string;
  startsOn: string;
  endsOn: string;
  datesApproximate: boolean;
  sourceUrl: string | null;
  evidenceNote: string;
  basisYears?: number[];
  timing: "upcoming" | "ongoing" | "past";
}

export async function getCalendar(filters: { company?: string | null; category?: string | null }, now: Date = new Date()) {
  let companyIds: string[] | null = null;
  if (filters.category) {
    const rows = await db
      .select({ id: companyCategories.companyId })
      .from(companyCategories)
      .innerJoin(categories, eq(categories.id, companyCategories.categoryId))
      .where(eq(categories.slug, filters.category));
    companyIds = rows.map((r) => r.id);
  }
  const rows = await db
    .select({ event: promotionalEvents, companyName: companies.name, companySlug: companies.slug })
    .from(promotionalEvents)
    .innerJoin(companies, eq(companies.id, promotionalEvents.companyId))
    .where(
      and(
        eq(promotionalEvents.isPublished, true),
        fixturesVisible() ? undefined : eq(promotionalEvents.isFixture, false),
        filters.company ? eq(companies.slug, filters.company) : undefined,
        companyIds ? inArray(promotionalEvents.companyId, companyIds.length ? companyIds : ["00000000-0000-0000-0000-000000000000"]) : undefined,
      ),
    )
    .orderBy(asc(promotionalEvents.startsOn));

  const companyNames = new Map(rows.map((r) => [r.event.companyId, { name: r.companyName, slug: r.companySlug }]));
  const stored: CalendarEvent[] = rows.map(({ event, companyName, companySlug }) => ({
    id: event.id,
    kind: event.kind,
    title: event.title,
    occasion: event.occasion,
    companyId: event.companyId,
    companyName,
    companySlug,
    startsOn: event.startsOn,
    endsOn: event.endsOn ?? event.startsOn,
    datesApproximate: event.datesApproximate,
    sourceUrl: event.sourceUrl,
    evidenceNote: event.evidenceNote,
    timing: eventTiming(event, now),
  }));

  const { predicted, withheld } = predictWindows(
    rows.map(({ event }) => ({ id: event.id, companyId: event.companyId, occasion: event.occasion, kind: event.kind, startsOn: event.startsOn, endsOn: event.endsOn })),
    now,
  );
  const predictedEvents: CalendarEvent[] = predicted.map((p: PredictedWindow) => ({
    id: `predicted-${p.companyId}-${p.occasion}-${p.year}`,
    kind: "predicted",
    title: `${companyNames.get(p.companyId)?.name ?? ""} ${OCCASION_LABEL[p.occasion]} (predicted)`,
    occasion: p.occasion,
    companyId: p.companyId,
    companyName: companyNames.get(p.companyId)?.name ?? "",
    companySlug: companyNames.get(p.companyId)?.slug ?? "",
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    datesApproximate: true,
    sourceUrl: null,
    evidenceNote: `Inferred from observed promotions in ${p.observedYears.join(" and ")}. Not announced.`,
    basisYears: p.observedYears,
    timing: eventTiming(p, now),
  }));

  const [companyOptions, categoryOptions] = await Promise.all([
    db
      .selectDistinct({ slug: companies.slug, name: companies.name })
      .from(companies)
      .innerJoin(promotionalEvents, and(eq(promotionalEvents.companyId, companies.id), eq(promotionalEvents.isPublished, true), fixturesVisible() ? undefined : eq(promotionalEvents.isFixture, false)))
      .orderBy(asc(companies.name)),
    db.select({ slug: categories.slug, name: categories.name }).from(categories).where(eq(categories.isVisible, true)).orderBy(asc(categories.sortOrder)),
  ]);

  return {
    events: [...stored, ...predictedEvents].sort((a, b) => a.startsOn.localeCompare(b.startsOn)),
    withheld: withheld.map((w: WithheldPrediction) => ({ ...w, companyName: companyNames.get(w.companyId)?.name ?? "" })),
    companyOptions,
    categoryOptions,
  };
}

/** Weeks (Monday first) covering a month, as ISO dates; days outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
