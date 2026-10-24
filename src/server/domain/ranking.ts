/**
 * Ordering offers for discovery (brief §9.3, §12). Sponsorship never affects organic order.
 */
import type { Availability } from "@/lib/enums";
import { countryStatusRank, type CountryStatusOrNone } from "./eligibility";
import { verificationStrength, type EffectiveVerificationState } from "./verification";

export const SORT_KEYS = [
  "relevance",
  "newest",
  "recently_verified",
  "highest_discount",
  "lowest_price",
  "expiring_soon",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface RankableOffer {
  id: string;
  /** 0–1 text match score; 0 when there is no query. */
  textScore: number;
  countryStatus: CountryStatusOrNone;
  verification: EffectiveVerificationState;
  verifiedAt: Date | null;
  publishedAt: Date | null;
  endsAt: Date | null;
  endsAtConfirmed: boolean;
  availability: Availability;
  /** Savings computed against a reliable reference (domain/pricing). */
  computedSavingsPercent: number | null;
  /** As advertised by the merchant; only used as a secondary tier. */
  advertisedDiscountPercent: number | null;
  monthlyPriceMinor: number | null;
  oneTimePriceMinor: number | null;
  currency: string | null;
  isSponsored: boolean;
}

const time = (d: Date | null) => (d ? d.getTime() : 0);

export function relevanceScore(o: RankableOffer, hasQuery: boolean): number {
  let score = 0;
  if (hasQuery) score += o.textScore * 6;
  score += (3 - countryStatusRank(o.countryStatus)) * 1.2;
  score += verificationStrength(o.verification) * 0.5;
  if (o.availability === "active") score += 1;
  if (o.computedSavingsPercent != null) score += Math.min(o.computedSavingsPercent, 100) / 100;
  return score;
}

export function rankOffers<T extends RankableOffer>(offers: T[], sort: SortKey, opts: { hasQuery: boolean; now?: Date }): T[] {
  const now = opts.now ?? new Date();
  const expiredLast = (a: T, b: T) => Number(a.availability === "expired") - Number(b.availability === "expired");
  const byRelevance = (a: T, b: T) => relevanceScore(b, opts.hasQuery) - relevanceScore(a, opts.hasQuery);

  const comparators: Record<SortKey, (a: T, b: T) => number> = {
    relevance: byRelevance,
    newest: (a, b) => time(b.publishedAt) - time(a.publishedAt),
    recently_verified: (a, b) => {
      const freshA = a.verification !== "stale" && a.verification !== "unverified";
      const freshB = b.verification !== "stale" && b.verification !== "unverified";
      if (freshA !== freshB) return freshA ? -1 : 1;
      return time(b.verifiedAt) - time(a.verifiedAt);
    },
    highest_discount: (a, b) => {
      const tier = (o: T) => (o.computedSavingsPercent != null ? 0 : o.advertisedDiscountPercent != null ? 1 : 2);
      const value = (o: T) => o.computedSavingsPercent ?? o.advertisedDiscountPercent ?? 0;
      return tier(a) - tier(b) || value(b) - value(a) || byRelevance(a, b);
    },
    lowest_price: (a, b) => {
      // Prices in different currencies are never converted; group by currency, unknown last.
      const known = (o: T) => o.monthlyPriceMinor != null || o.oneTimePriceMinor != null;
      if (known(a) !== known(b)) return known(a) ? -1 : 1;
      if (!known(a)) return byRelevance(a, b);
      const ca = a.currency ?? "";
      const cb = b.currency ?? "";
      if (ca !== cb) return ca === "USD" ? -1 : cb === "USD" ? 1 : ca.localeCompare(cb);
      const pa = a.monthlyPriceMinor ?? a.oneTimePriceMinor ?? 0;
      const pb = b.monthlyPriceMinor ?? b.oneTimePriceMinor ?? 0;
      return pa - pb;
    },
    expiring_soon: (a, b) => {
      const upcoming = (o: T) => o.endsAtConfirmed && !!o.endsAt && o.endsAt.getTime() > now.getTime();
      if (upcoming(a) !== upcoming(b)) return upcoming(a) ? -1 : 1;
      if (!upcoming(a)) return byRelevance(a, b);
      return time(a.endsAt) - time(b.endsAt);
    },
  };

  return [...offers].sort((a, b) => expiredLast(a, b) || comparators[sort](a, b) || a.id.localeCompare(b.id));
}

export interface BestOfferCandidate {
  id: string;
  planId: string | null;
  currency: string | null;
  countryStatus: CountryStatusOrNone;
  availability: Availability;
  first12MonthsMinor: number | null;
}

/**
 * The best available offer is only declared when at least two active, confirmed-eligible offers
 * for the same plan and currency have a computable 12-month cost. Otherwise return null and
 * show a neutral list (brief §12).
 */
export function pickBestOffer(candidates: BestOfferCandidate[]): { bestId: string; comparedIds: string[] } | null {
  const eligible = candidates.filter(
    (c) => c.availability === "active" && c.countryStatus === "confirmed_eligible" && c.first12MonthsMinor != null && c.planId && c.currency,
  );
  const groups = new Map<string, BestOfferCandidate[]>();
  for (const c of eligible) {
    const key = `${c.planId}|${c.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const comparable = [...groups.values()].filter((g) => g.length >= 2);
  if (comparable.length !== 1) return null;
  const group = [...comparable[0]].sort((a, b) => (a.first12MonthsMinor ?? 0) - (b.first12MonthsMinor ?? 0));
  if (group[0].first12MonthsMinor === group[1].first12MonthsMinor) return null;
  return { bestId: group[0].id, comparedIds: group.map((g) => g.id) };
}
