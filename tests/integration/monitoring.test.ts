import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { resetHttpState } from "@/server/connectors/http";
import { runPartnerFeed } from "@/server/connectors/partner-feed";
import { runRssConnector } from "@/server/connectors/rss";
import { closeDb, db } from "@/server/db";
import {
  connectors,
  discoveryCandidates,
  jobRuns,
  monitoringJobs,
  offerRevisions,
  offerSources,
  offers,
  promotionalEvents,
  reviewItems,
  sourceObservations,
  sources,
  verificationRecords,
} from "@/server/db/schema";
import { claimDueJobs } from "@/server/jobs/queue";
import { runDueJobs } from "@/server/jobs/runner";
import { addCoupon, attachSource, createOffer, recordVerification, setPublicationStatus } from "@/server/services/admin-offers";
import { createCompany } from "@/server/services/admin-catalog";
import { getOfferDetail } from "@/server/services/offer-detail";
import { archiveExpired, checkOffer, expireOffers, staleScan } from "@/server/services/monitoring";
import { makeStaff, resetDatabase } from "./helpers";

// --- Local fixture web server standing in for merchant sites -------------------------------
let hits503 = 0;
const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const html = (body: string) => new Response(`<html><body><script>ignored()</script>${body}</body></html>`, { headers: { "content-type": "text/html" } });
    switch (pathname) {
      case "/robots.txt":
        return new Response("User-agent: *\nDisallow: /private\n", { headers: { "content-type": "text/plain" } });
      case "/promo":
        return html("<h1>Students</h1><p>Get 50% off for students — limited time.</p>");
      case "/moved":
        return new Response(null, { status: 301, headers: { location: "/promo" } });
      case "/changed":
        return html("<p>Our plans start at $20.</p>");
      case "/gone":
        return new Response("Not found", { status: 404 });
      case "/flaky":
        hits503++;
        return new Response("Unavailable", { status: 503 });
      case "/slow":
        await Bun.sleep(1500);
        return html("late");
      case "/private/terms":
        return html("should never be fetched");
      case "/feed.xml":
        return new Response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>
            <item><title>Black Friday: 40% off all plans</title><link>https://www.monitor.example/blog/bf</link><guid>bf-1</guid><pubDate>${new Date().toUTCString()}</pubDate><description>Annual plans discounted.</description></item>
            <item><title>New dark mode</title><link>https://www.monitor.example/blog/dark</link><guid>dm-1</guid><pubDate>${new Date().toUTCString()}</pubDate></item>
            <item><title>Old student discount</title><link>https://www.monitor.example/blog/old</link><guid>old-1</guid><pubDate>${new Date(Date.now() - 400 * 86_400_000).toUTCString()}</pubDate></item>
          </channel></rss>`,
          { headers: { "content-type": "application/rss+xml" } },
        );
      default:
        return new Response("Not found", { status: 404 });
    }
  },
});
const local = (path: string) => `http://127.0.0.1:${server.port}${path}`;

let admin: Awaited<ReturnType<typeof makeStaff>>;
let companyId = "";
let offerId = "";

async function linkSource(id: string, path: string, markers: string[]) {
  const [source] = await db.insert(sources).values({ url: local(path), sourceType: "official_promo_page", isOfficial: true }).onConflictDoNothing().returning();
  const sourceRow = source ?? (await db.select().from(sources).where(eq(sources.url, local(path))))[0];
  await db.delete(offerSources).where(eq(offerSources.offerId, id));
  await db.insert(offerSources).values({ offerId: id, sourceId: sourceRow.id, role: "terms", expectedMarkers: markers });
  return sourceRow;
}

async function freshOffer(title: string, extra: Record<string, unknown> = {}) {
  const created = await createOffer(admin, {
    companyId,
    title,
    benefit: "50% off",
    offerType: "direct",
    availability: "active",
    redemptionUrl: `https://www.monitor.example/${encodeURIComponent(title)}`,
    ...extra,
  });
  await attachSource(admin, { offerId: created.id, url: `https://www.monitor.example/terms/${created.slug}`, sourceType: "official_promo_page", isOfficial: true, role: "terms" });
  await recordVerification(admin, { offerId: created.id, state: "officially_confirmed", method: "editorial_official_page_review", evidenceUrl: "https://www.monitor.example/terms", verifiedAt: new Date(Date.now() - 2 * 86_400_000) });
  const published = await setPublicationStatus(admin, created.id, "published");
  if (!published.ok) throw new Error(published.problems.join(";"));
  return created;
}

beforeAll(async () => {
  await resetDatabase();
  admin = await makeStaff("admin");
  companyId = (await createCompany(admin, { name: "Monitor Co", websiteUrl: "https://www.monitor.example", allowedDomains: ["monitor.example"] })).id;
  offerId = (await freshOffer("Monitored offer")).id;
});
beforeEach(() => resetHttpState());
afterAll(async () => {
  server.stop(true);
  await closeDb();
});

const openReviews = (kind: string, id = offerId) => db.select().from(reviewItems).where(and(eq(reviewItems.offerId, id), eq(reviewItems.kind, kind as never), eq(reviewItems.status, "open")));

describe("official page checks", () => {
  test("all expected terms present → observation ok and verification refreshed automatically", async () => {
    await linkSource(offerId, "/promo", ["50% off", "for students"]);
    const before = (await db.select().from(offers).where(eq(offers.id, offerId)))[0];
    const outcome = await checkOffer(offerId);
    expect(outcome.status).toBe("success");
    const after = (await db.select().from(offers).where(eq(offers.id, offerId)))[0];
    expect(after.lastCheckedAt).not.toBeNull();
    expect(after.verifiedAt!.getTime()).toBeGreaterThan(before.verifiedAt!.getTime());
    const [obs] = await db.select().from(sourceObservations).where(eq(sourceObservations.offerId, offerId));
    expect(obs.outcome).toBe("ok");
    expect(obs.excerpt).toContain("50% off");
    expect(obs.excerpt).not.toContain("ignored()");
    const records = await db.select().from(verificationRecords).where(and(eq(verificationRecords.offerId, offerId), eq(verificationRecords.method, "automated_official_page_check")));
    expect(records).toHaveLength(1);
  });

  test("missing terms open a review item but never change availability or refresh evidence", async () => {
    await linkSource(offerId, "/changed", ["50% off"]);
    const before = (await db.select().from(offers).where(eq(offers.id, offerId)))[0];
    await checkOffer(offerId);
    const after = (await db.select().from(offers).where(eq(offers.id, offerId)))[0];
    expect(after.availability).toBe("active");
    expect(after.verifiedAt!.getTime()).toBe(before.verifiedAt!.getTime());
    expect(await openReviews("markers_missing")).toHaveLength(1);
    await checkOffer(offerId); // repeated finding does not duplicate the review item
    expect(await openReviews("markers_missing")).toHaveLength(1);
  });

  test("404 opens a high-priority review; the offer is not expired", async () => {
    await linkSource(offerId, "/gone", []);
    await checkOffer(offerId);
    const [item] = await openReviews("page_not_found");
    expect(item.priority).toBe(1);
    expect((await db.select().from(offers).where(eq(offers.id, offerId)))[0].availability).toBe("active");
  });

  test("transient failures retry with backoff and escalate after three, still not expired", async () => {
    const source = await linkSource(offerId, "/flaky", []);
    await db.update(sources).set({ consecutiveFailures: 0 }).where(eq(sources.id, source.id));
    const first = await checkOffer(offerId);
    expect(first).toMatchObject({ status: "failure", retry: true });
    await checkOffer(offerId);
    expect(await openReviews("repeated_failures")).toHaveLength(0);
    await checkOffer(offerId);
    expect(await openReviews("repeated_failures")).toHaveLength(1);
    expect(hits503).toBe(3);
    expect((await db.select().from(sources).where(eq(sources.id, source.id)))[0].consecutiveFailures).toBe(3);
    expect((await db.select().from(offers).where(eq(offers.id, offerId)))[0].availability).toBe("active");
  });

  test("robots.txt disallow is respected (page never fetched) and routed to review", async () => {
    await linkSource(offerId, "/private/terms", []);
    await checkOffer(offerId);
    const obs = await db.select().from(sourceObservations).where(eq(sourceObservations.outcome, "robots_disallowed"));
    expect(obs).toHaveLength(1);
    expect(await openReviews("robots_disallowed")).toHaveLength(1);
  });

  test("same-host redirects don't time out because of the politeness wait (regression from the first live run)", async () => {
    process.env.CONNECTOR_HOST_INTERVAL_MS = "400";
    process.env.CONNECTOR_TIMEOUT_MS = "300";
    await linkSource(offerId, "/moved", ["50% off"]);
    const outcome = await checkOffer(offerId);
    process.env.CONNECTOR_HOST_INTERVAL_MS = "0";
    delete process.env.CONNECTOR_TIMEOUT_MS;
    expect(outcome.status).toBe("success");
    const [obs] = await db.select().from(sourceObservations).where(eq(sourceObservations.outcome, "redirected"));
    expect(obs.finalUrl).toBe(local("/promo"));
  });

  test("slow pages time out instead of hanging", async () => {
    process.env.CONNECTOR_TIMEOUT_MS = "300";
    await linkSource(offerId, "/slow", []);
    const outcome = await checkOffer(offerId);
    delete process.env.CONNECTOR_TIMEOUT_MS;
    expect(outcome.status).toBe("failure");
    const [obs] = await db.select().from(sourceObservations).where(eq(sourceObservations.outcome, "timeout"));
    expect(obs).toBeDefined();
  });
});

describe("durable job queue", () => {
  test("a due job is claimed by exactly one worker and its run is recorded", async () => {
    await linkSource(offerId, "/promo", ["50% off"]);
    const key = `offer_check:${offerId}`;
    await db.update(monitoringJobs).set({ nextRunAt: new Date(Date.now() - 1000), lockedAt: null, attempts: 0 }).where(eq(monitoringJobs.uniqueKey, key));
    const [job] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.uniqueKey, key));
    const [a, b] = await Promise.all([claimDueJobs("w1", 5, job.id), claimDueJobs("w2", 5, job.id)]);
    expect(a.length + b.length).toBe(1);
    await db.update(monitoringJobs).set({ lockedAt: null }).where(eq(monitoringJobs.id, job.id));

    const summary = await runDueJobs({ workerId: "test", onlyJobId: job.id });
    expect(summary[0]).toMatchObject({ kind: "offer_check", status: "success" });
    const runs = await db.select().from(jobRuns).where(eq(jobRuns.jobId, job.id));
    expect(runs).toHaveLength(1);
    const [after] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.id, job.id));
    expect(after.lockedAt).toBeNull();
    expect(after.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 60 * 60_000);
  });

  test("a failing job backs off for minutes, not its full interval", async () => {
    await linkSource(offerId, "/flaky", []);
    const [job] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.uniqueKey, `offer_check:${offerId}`));
    await db.update(monitoringJobs).set({ nextRunAt: new Date(Date.now() - 1000), attempts: 0 }).where(eq(monitoringJobs.id, job.id));
    await runDueJobs({ workerId: "test", onlyJobId: job.id });
    const [after] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.id, job.id));
    expect(after.attempts).toBe(1);
    const delayMin = (after.nextRunAt.getTime() - Date.now()) / 60_000;
    expect(delayMin).toBeGreaterThan(3);
    expect(delayMin).toBeLessThan(6);
  });
});

describe("expiry, archival and staleness", () => {
  test("a confirmed past end date expires the offer and records history; an unconfirmed one only flags review", async () => {
    const confirmed = await freshOffer("Confirmed end", { startsAt: new Date(Date.now() - 20 * 86_400_000), endsAt: new Date(Date.now() + 86_400_000), endsAtConfirmed: true });
    const unconfirmed = await freshOffer("Unconfirmed end", { endsAt: new Date(Date.now() + 86_400_000) });
    const past = new Date(Date.now() - 3600_000);
    await db.update(offers).set({ endsAt: past }).where(eq(offers.id, confirmed.id));
    await db.update(offers).set({ endsAt: past }).where(eq(offers.id, unconfirmed.id));

    const outcome = await expireOffers();
    expect(outcome.stats).toMatchObject({ expired: 1, flagged: 1 });
    expect((await db.select().from(offers).where(eq(offers.id, confirmed.id)))[0].availability).toBe("expired");
    expect((await db.select().from(offers).where(eq(offers.id, unconfirmed.id)))[0].availability).toBe("active");
    expect(await openReviews("unconfirmed_end_date_passed", unconfirmed.id)).toHaveLength(1);
    const revisions = await db.select().from(offerRevisions).where(and(eq(offerRevisions.offerId, confirmed.id), eq(offerRevisions.changeType, "expired")));
    expect(revisions).toHaveLength(1);
    const [event] = await db.select().from(promotionalEvents).where(eq(promotionalEvents.offerId, confirmed.id));
    expect(event).toMatchObject({ kind: "historical", isPublished: false });
    const [job] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.uniqueKey, `offer_check:${confirmed.id}`));
    expect(job.enabled).toBe(false);
  });

  test("expired offers are archived after 30 days and their page keeps its history", async () => {
    const [expired] = await db.select().from(offers).where(eq(offers.availability, "expired"));
    expect((await archiveExpired()).stats).toMatchObject({ archived: 0 });
    await db.update(offerRevisions).set({ changedAt: new Date(Date.now() - 31 * 86_400_000) }).where(and(eq(offerRevisions.offerId, expired.id), eq(offerRevisions.changeType, "expired")));
    expect((await archiveExpired()).stats).toMatchObject({ archived: 1 });
    const detail = await getOfferDetail(expired.slug, null);
    expect(detail?.isArchived).toBe(true);
    expect(detail?.revisions.some((r) => r.changeType === "expired")).toBe(true);
  });

  test("stale evidence is queued for review once", async () => {
    await db.update(offers).set({ verifiedAt: new Date(Date.now() - 45 * 86_400_000) }).where(eq(offers.id, offerId));
    await staleScan();
    await staleScan();
    expect(await openReviews("stale_verification")).toHaveLength(1);
  });
});

describe("connectors", () => {
  test("RSS: only recent keyword matches become candidates, deduplicated across runs", async () => {
    const config = { feeds: [{ url: local("/feed.xml"), companySlug: "monitor-co" }], keywords: ["black friday", "% off", "student"], lookbackDays: 30 };
    const first = await runRssConnector("rss-announcements", config);
    expect(first).toMatchObject({ ok: true, created: 1 });
    const second = await runRssConnector("rss-announcements", config);
    expect(second.created).toBe(0);
    const [candidate] = await db.select().from(discoveryCandidates);
    expect(candidate.title).toBe("Black Friday: 40% off all plans");
    expect(candidate.companyId).toBe(companyId);
    expect((await db.select().from(reviewItems).where(eq(reviewItems.kind, "discovery_candidate"))).length).toBe(1);
  });

  test("partner feed: not configured → skipped; equivalent items merge into the canonical offer with provenance", async () => {
    expect(await runPartnerFeed("partner-json-feed", { mapping: {} })).toMatchObject({ ok: true, skipped: true });
    const coupon = await createOffer(admin, { companyId, title: "Coupon offer", benefit: "20% off", offerType: "coupon", redemptionUrl: "https://www.monitor.example/checkout" });
    await addCoupon(admin, { offerId: coupon.id, code: "SAVE20", status: "officially_published" });
    const mapping = { externalId: "id", title: "name", url: "link", code: "coupon", endsAt: "expires", discountPercent: "pct" };
    const body = JSON.stringify({
      items: [
        { id: 1, name: "Monitor Co: 20% off", link: "https://monitor.example/checkout?utm_source=partner", coupon: "SAVE20", expires: "2026-12-31", pct: 20 },
        { id: 2, name: "Monitor Co: new summer sale", link: "https://www.monitor.example/summer", pct: 30 },
        { id: 3, name: "x", link: "javascript:alert(1)" },
      ],
    });
    const result = await runPartnerFeed("partner-json-feed", { mapping }, new Date(), body);
    expect(result).toMatchObject({ ok: true, merged: 1, candidates: 1, rejected: 1 });
    const links = await db.select().from(offerSources).where(eq(offerSources.offerId, coupon.id));
    expect(links.length).toBe(1);
    const observations = await db.select().from(sourceObservations).where(and(eq(sourceObservations.offerId, coupon.id), eq(sourceObservations.connectorKey, "partner-json-feed")));
    expect(observations).toHaveLength(1);
    // Merged data never changes publication or verification by itself.
    const [row] = await db.select().from(offers).where(eq(offers.id, coupon.id));
    expect(row.publicationStatus).toBe("draft");
    expect(row.verificationState).toBe("unverified");
  });

  test("connector bookkeeping records last run and success", async () => {
    await db.update(connectors).set({ config: { feeds: [{ url: local("/feed.xml"), companySlug: "monitor-co" }], keywords: ["black friday"], lookbackDays: 30 } }).where(eq(connectors.key, "rss-announcements"));
    await db.insert(monitoringJobs).values({ kind: "connector_run", targetId: "rss-announcements", uniqueKey: "connector:rss-announcements", intervalMinutes: 1440, nextRunAt: new Date(Date.now() - 1000) }).onConflictDoNothing();
    const [job] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.uniqueKey, "connector:rss-announcements"));
    await db.update(monitoringJobs).set({ nextRunAt: new Date(Date.now() - 1000), enabled: true }).where(eq(monitoringJobs.id, job.id));
    const [run] = await runDueJobs({ workerId: "test", onlyJobId: job.id });
    expect(run.status).toBe("success");
    const [c] = await db.select().from(connectors).where(eq(connectors.key, "rss-announcements"));
    expect(c.lastSuccessAt).not.toBeNull();
    expect(c.consecutiveFailures).toBe(0);
  });
});
