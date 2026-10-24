/**
 * Deals Calendar classification and evidence-based predictions (brief §18).
 *
 * Confirmed and historical events are stored with sources. Predicted windows are derived on
 * demand from historical events and are withheld unless the same company + occasion was
 * observed in at least MIN_YEARS distinct years.
 */
import type { Occasion } from "@/lib/enums";

export const MIN_YEARS_FOR_PREDICTION = 2;
const PREDICTABLE: Occasion[] = ["black_friday", "cyber_monday", "back_to_school", "new_year", "anniversary", "seasonal", "holiday", "student_period"];

export interface DatedEvent {
  id: string;
  companyId: string;
  occasion: Occasion;
  kind: "confirmed" | "historical";
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
}

export interface PredictedWindow {
  companyId: string;
  occasion: Occasion;
  year: number;
  startsOn: string;
  endsOn: string;
  basisEventIds: string[];
  observedYears: number[];
}

export interface WithheldPrediction {
  companyId: string;
  occasion: Occasion;
  observedYears: number[];
  reason: string;
}

const DAY_MS = 86_400_000;

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** US Black Friday: the day after the fourth Thursday of November. */
export function blackFriday(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const firstThursday = 1 + ((4 - nov1.getUTCDay() + 7) % 7);
  return new Date(Date.UTC(year, 10, firstThursday + 21 + 1));
}

function anchorFor(occasion: Occasion, year: number): Date | null {
  if (occasion === "black_friday") return blackFriday(year);
  if (occasion === "cyber_monday") return new Date(blackFriday(year).getTime() + 3 * DAY_MS);
  return null;
}

/** Day offsets of start/end relative to the occasion anchor (or Jan 1 for fixed-date occasions). */
function offsets(e: DatedEvent): { year: number; start: number; end: number } {
  const start = parseDay(e.startsOn);
  const end = e.endsOn ? parseDay(e.endsOn) : start;
  const year = start.getUTCFullYear();
  const anchor = anchorFor(e.occasion, year) ?? new Date(Date.UTC(year, 0, 1));
  return {
    year,
    start: Math.round((start.getTime() - anchor.getTime()) / DAY_MS),
    end: Math.round((end.getTime() - anchor.getTime()) / DAY_MS),
  };
}

export function predictWindows(
  events: DatedEvent[],
  now: Date = new Date(),
): { predicted: PredictedWindow[]; withheld: WithheldPrediction[] } {
  const predicted: PredictedWindow[] = [];
  const withheld: WithheldPrediction[] = [];
  const groups = new Map<string, DatedEvent[]>();
  for (const e of events) {
    if (!PREDICTABLE.includes(e.occasion)) continue;
    const key = `${e.companyId}|${e.occasion}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  for (const group of groups.values()) {
    const { companyId, occasion } = group[0];
    const historical = group.filter((e) => e.kind === "historical");
    const confirmed = group.filter((e) => e.kind === "confirmed");
    const byYear = new Map<number, DatedEvent>();
    for (const e of historical) {
      const year = parseDay(e.startsOn).getUTCFullYear();
      if (!byYear.has(year)) byYear.set(year, e);
    }
    const years = [...byYear.keys()].sort();
    if (years.length < MIN_YEARS_FOR_PREDICTION) {
      withheld.push({
        companyId,
        occasion,
        observedYears: years,
        reason: `Observed in ${years.length} year${years.length === 1 ? "" : "s"}; at least ${MIN_YEARS_FOR_PREDICTION} are needed before showing a predicted window.`,
      });
      continue;
    }

    const spans = [...byYear.values()].map(offsets);
    const startOffset = Math.min(...spans.map((s) => s.start));
    const endOffset = Math.max(...spans.map((s) => s.end));

    let year = Math.max(now.getUTCFullYear(), years[years.length - 1] + 1);
    for (let attempt = 0; attempt < 2; attempt++) {
      const anchor = anchorFor(occasion, year) ?? new Date(Date.UTC(year, 0, 1));
      const end = new Date(anchor.getTime() + endOffset * DAY_MS);
      if (end.getTime() >= now.getTime()) break;
      year += 1;
    }
    // A confirmed announcement for that year replaces any prediction.
    if (confirmed.some((e) => parseDay(e.startsOn).getUTCFullYear() === year)) continue;

    const anchor = anchorFor(occasion, year) ?? new Date(Date.UTC(year, 0, 1));
    predicted.push({
      companyId,
      occasion,
      year,
      startsOn: fmtDay(new Date(anchor.getTime() + startOffset * DAY_MS)),
      endsOn: fmtDay(new Date(anchor.getTime() + endOffset * DAY_MS)),
      basisEventIds: [...byYear.values()].map((e) => e.id),
      observedYears: years,
    });
  }
  return { predicted, withheld };
}

/** Classify a stored event for display relative to today. */
export function eventTiming(e: { startsOn: string; endsOn: string | null }, now: Date = new Date()): "upcoming" | "ongoing" | "past" {
  const today = fmtDay(now);
  const end = e.endsOn ?? e.startsOn;
  if (e.startsOn > today) return "upcoming";
  if (end >= today) return "ongoing";
  return "past";
}
