/**
 * Official announcement feeds (RSS 2.0 / Atom) → discovery candidates for human review.
 * Feeds are published for syndication; we store only title, link, date and matched keywords.
 */
import { XMLParser } from "fast-xml-parser";
import { inArray } from "drizzle-orm";
import { db } from "../db";
import { companies, discoveryCandidates } from "../db/schema";
import { parseHttpUrl } from "../domain/url-safety";
import { politeFetch } from "./http";
import { openReviewItem } from "../services/review";

export interface FeedItem {
  externalId: string;
  title: string;
  link: string;
  publishedAt: Date | null;
  text: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, htmlEntities: true });
const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const textOf = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
};
const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  if (doc?.rss?.channel) {
    return asArray(doc.rss.channel.item).map((item: Record<string, unknown>) => {
      const link = textOf(item.link);
      const date = textOf(item.pubDate);
      return {
        externalId: textOf(item.guid) || link,
        title: stripTags(textOf(item.title)),
        link,
        publishedAt: date ? new Date(date) : null,
        text: stripTags(`${textOf(item.title)} ${textOf(item.description)}`).slice(0, 2000),
      };
    });
  }
  if (doc?.feed) {
    return asArray(doc.feed.entry).map((entry: Record<string, unknown>) => {
      const links = asArray(entry.link as Record<string, string> | Record<string, string>[]);
      const link = (links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0])?.["@_href"] ?? "";
      const date = textOf(entry.published) || textOf(entry.updated);
      return {
        externalId: textOf(entry.id) || link,
        title: stripTags(textOf(entry.title)),
        link,
        publishedAt: date ? new Date(date) : null,
        text: stripTags(`${textOf(entry.title)} ${textOf(entry.summary)}`).slice(0, 2000),
      };
    });
  }
  return [];
}

export function matchKeywords(text: string, keywords: string[]): string[] {
  const hay = text.toLowerCase();
  return keywords.filter((k) => hay.includes(k.toLowerCase()));
}

export interface RssConfig {
  feeds: { url: string; companySlug: string }[];
  keywords: string[];
  lookbackDays: number;
}

export async function runRssConnector(key: string, config: RssConfig, now: Date = new Date()) {
  const feeds = config.feeds ?? [];
  if (!feeds.length) return { ok: true, skipped: true, message: "No feeds configured.", created: 0, errors: [] as string[] };
  const slugs = feeds.map((f) => f.companySlug);
  const companyRows = slugs.length ? await db.select({ id: companies.id, slug: companies.slug }).from(companies).where(inArray(companies.slug, slugs)) : [];
  const companyBySlug = new Map(companyRows.map((c) => [c.slug, c.id]));
  const since = now.getTime() - (config.lookbackDays ?? 30) * 86_400_000;
  let created = 0;
  let retrieved = 0;
  const errors: string[] = [];

  for (const feed of feeds) {
    const res = await politeFetch(feed.url, { accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8" });
    if (res.result.kind !== "response" || res.result.httpStatus !== 200 || !res.body) {
      errors.push(`${feed.url}: ${res.result.kind === "response" ? `HTTP ${res.result.httpStatus}` : res.result.kind}`);
      continue;
    }
    retrieved++;
    let items: FeedItem[];
    try {
      items = parseFeed(res.body);
    } catch {
      errors.push(`${feed.url}: unparseable feed`);
      continue;
    }
    for (const item of items) {
      if (!item.link || !parseHttpUrl(item.link)) continue;
      if (item.publishedAt && (Number.isNaN(item.publishedAt.getTime()) || item.publishedAt.getTime() < since)) continue;
      const matched = matchKeywords(item.text, config.keywords ?? []);
      if (!matched.length) continue;
      const [row] = await db
        .insert(discoveryCandidates)
        .values({
          connectorKey: key,
          sourceUrl: item.link,
          externalId: item.externalId.slice(0, 500),
          title: item.title.slice(0, 300),
          publishedAt: item.publishedAt && !Number.isNaN(item.publishedAt.getTime()) ? item.publishedAt : null,
          matchedKeywords: matched,
          companyId: companyBySlug.get(feed.companySlug) ?? null,
        })
        .onConflictDoNothing({ target: [discoveryCandidates.connectorKey, discoveryCandidates.externalId] })
        .returning({ id: discoveryCandidates.id });
      if (row) {
        created++;
        await openReviewItem(db, {
          kind: "discovery_candidate",
          priority: 3,
          title: `Possible promotion: ${item.title.slice(0, 120)}`,
          details: `From ${feed.companySlug}'s official feed (matched: ${matched.join(", ")}). Unverified signal — confirm the terms on an official page before creating an offer.`,
          dedupeKey: `candidate:${row.id}`,
          payload: { candidateId: row.id, url: item.link },
        });
      }
    }
  }
  const ok = retrieved > 0 || feeds.length === 0;
  return { ok, skipped: false, message: `${retrieved}/${feeds.length} feeds read, ${created} new candidates${errors.length ? `; errors: ${errors.join("; ")}` : ""}`, created, errors };
}
