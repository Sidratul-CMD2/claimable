/**
 * Authorized partner / affiliate feed (JSON). Requires PARTNER_FEED_URL (and usually
 * PARTNER_FEED_TOKEN) plus a signed agreement permitting use of the deal data. Without them
 * the connector reports "not configured" and does nothing.
 *
 * Items are normalised and validated. An item equivalent to an existing offer (same company,
 * redemption destination and code) is merged: its source and an observation are attached to
 * the canonical offer, preserving provenance. Anything else becomes a discovery candidate for
 * review. Nothing is published automatically.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { companies, coupons, discoveryCandidates, offerSources, offers, sourceObservations, sources } from "../db/schema";
import { hostMatches, normalizeUrlForComparison, parseHttpUrl } from "../domain/url-safety";
import { politeFetch } from "./http";
import { openReviewItem } from "../services/review";

export interface PartnerFeedConfig {
  mapping: Record<string, string>;
}

const itemSchema = z.object({
  externalId: z.string().min(1).max(200),
  title: z.string().min(3).max(300),
  url: z.string().max(2000).refine((u) => parseHttpUrl(u)?.protocol === "https:", "https URL required"),
  code: z.string().max(64).regex(/^[A-Za-z0-9._-]+$/).nullable().optional(),
  companyDomain: z.string().max(200).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  countries: z.array(z.string().length(2)).nullable().optional(),
  discountPercent: z.coerce.number().int().min(1).max(100).nullable().optional(),
});
export type PartnerItem = z.infer<typeof itemSchema>;

const pick = (obj: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), obj);

export function normalizeItems(raw: unknown, mapping: Record<string, string>): { items: PartnerItem[]; rejected: number } {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown[] })?.items) ? (raw as { items: unknown[] }).items : [];
  const items: PartnerItem[] = [];
  let rejected = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== "object") {
      rejected++;
      continue;
    }
    const mapped = Object.fromEntries(Object.entries(mapping).map(([field, path]) => [field, pick(entry as Record<string, unknown>, path) ?? null]));
    const parsed = itemSchema.safeParse({ ...mapped, externalId: mapped.externalId != null ? String(mapped.externalId) : undefined });
    if (parsed.success) items.push(parsed.data);
    else rejected++;
  }
  return { items, rejected };
}

export function partnerFeedConfigured() {
  return !!process.env.PARTNER_FEED_URL;
}

export async function runPartnerFeed(key: string, config: PartnerFeedConfig, now: Date = new Date(), body?: string) {
  if (!partnerFeedConfigured() && body === undefined) {
    return { ok: true, skipped: true, message: "Not configured: set PARTNER_FEED_URL/PARTNER_FEED_TOKEN after a partner agreement exists.", merged: 0, candidates: 0, rejected: 0 };
  }
  let json: unknown;
  if (body === undefined) {
    const url = process.env.PARTNER_FEED_URL!;
    const token = process.env.PARTNER_FEED_TOKEN;
    const res = await politeFetch(url, { accept: "application/json", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.result.kind !== "response" || res.result.httpStatus !== 200 || !res.body) {
      return { ok: false, skipped: false, message: `Feed retrieval failed: ${res.result.kind === "response" ? `HTTP ${res.result.httpStatus}` : res.result.kind}`, merged: 0, candidates: 0, rejected: 0 };
    }
    body = res.body;
  }
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, skipped: false, message: "Feed is not valid JSON", merged: 0, candidates: 0, rejected: 0 };
  }
  const { items, rejected } = normalizeItems(json, config.mapping);
  const allCompanies = await db.select({ id: companies.id, name: companies.name, domains: companies.allowedDomains }).from(companies);
  let merged = 0;
  let candidates = 0;

  for (const item of items) {
    const host = parseHttpUrl(item.url)!.hostname;
    const company = allCompanies.find((c) => c.domains.some((d) => hostMatches(host, d)) || (item.companyDomain && c.domains.some((d) => hostMatches(item.companyDomain!, d))));
    let canonicalId: string | null = null;
    if (company) {
      const companyOffers = await db.select({ id: offers.id, redemptionUrl: offers.redemptionUrl }).from(offers).where(and(eq(offers.companyId, company.id), eq(offers.isFixture, false)));
      for (const o of companyOffers) {
        if (normalizeUrlForComparison(o.redemptionUrl) !== normalizeUrlForComparison(item.url)) continue;
        if (item.code) {
          const [match] = await db.select({ id: coupons.id }).from(coupons).where(and(eq(coupons.offerId, o.id), eq(coupons.code, item.code)));
          if (!match) continue;
        }
        canonicalId = o.id;
        break;
      }
    }
    if (canonicalId) {
      await db.transaction(async (tx) => {
        const [source] = await tx
          .insert(sources)
          .values({ url: item.url, sourceType: "partner_feed", title: item.title, publisher: key, isOfficial: false, connectorKey: key, lastCheckedAt: now, lastSuccessAt: now, lastOutcome: "ok" })
          .onConflictDoUpdate({ target: sources.url, set: { lastCheckedAt: now, lastSuccessAt: now, lastOutcome: "ok" } })
          .returning();
        await tx.insert(offerSources).values({ offerId: canonicalId!, sourceId: source.id, role: "supporting" }).onConflictDoNothing();
        await tx.insert(sourceObservations).values({
          sourceId: source.id,
          offerId: canonicalId,
          connectorKey: key,
          observedAt: now,
          outcome: "ok",
          extracted: { externalId: item.externalId, code: item.code ?? null, endsAt: item.endsAt?.toISOString() ?? null, countries: item.countries ?? null, discountPercent: item.discountPercent ?? null },
        });
      });
      merged++;
      continue;
    }
    const [row] = await db
      .insert(discoveryCandidates)
      .values({ connectorKey: key, sourceUrl: item.url, externalId: item.externalId, title: item.title, companyId: company?.id ?? null, publishedAt: item.startsAt ?? null, payload: item })
      .onConflictDoNothing({ target: [discoveryCandidates.connectorKey, discoveryCandidates.externalId] })
      .returning({ id: discoveryCandidates.id });
    if (row) {
      candidates++;
      await openReviewItem(db, {
        kind: "discovery_candidate",
        priority: 3,
        title: `Partner feed item: ${item.title.slice(0, 120)}`,
        details: `${company ? company.name : "Unknown company"}${item.code ? ` · code ${item.code}` : ""}. Partner data is not proof the offer works; verify before publishing.`,
        dedupeKey: `candidate:${row.id}`,
        payload: { candidateId: row.id, url: item.url },
      });
    }
  }
  return { ok: true, skipped: false, message: `${items.length} valid items (${rejected} rejected): ${merged} merged into existing offers, ${candidates} new candidates`, merged, candidates, rejected };
}
