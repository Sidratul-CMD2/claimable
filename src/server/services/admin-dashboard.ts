/** Read models for the admin dashboard: queues, freshness, job health and connector status. */
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, companies, connectors, jobRuns, monitoringJobs, offers, reviewItems, sourceObservations, sources, userReports } from "../db/schema";
import { effectiveVerification } from "../domain/verification";

export async function dashboardSummary(now: Date = new Date()) {
  const in14 = new Date(now.getTime() + 14 * 86_400_000);
  const since24h = new Date(now.getTime() - 86_400_000);
  const [statusCounts, published, expiring, reviewCounts, openReports, runs, failingJobs, connectorRows, recentAudit] = await Promise.all([
    db.select({ status: offers.publicationStatus, count: sql<number>`count(*)::int` }).from(offers).where(eq(offers.isFixture, false)).groupBy(offers.publicationStatus),
    db
      .select({ id: offers.id, slug: offers.slug, title: offers.title, state: offers.verificationState, verifiedAt: offers.verifiedAt, riskTier: offers.riskTier, company: companies.name })
      .from(offers)
      .innerJoin(companies, eq(companies.id, offers.companyId))
      .where(and(eq(offers.publicationStatus, "published"), ne(offers.availability, "expired"))),
    db
      .select({ id: offers.id, slug: offers.slug, title: offers.title, endsAt: offers.endsAt })
      .from(offers)
      .where(and(eq(offers.publicationStatus, "published"), eq(offers.endsAtConfirmed, true), gte(offers.endsAt, now), lte(offers.endsAt, in14)))
      .orderBy(asc(offers.endsAt)),
    db.select({ kind: reviewItems.kind, count: sql<number>`count(*)::int` }).from(reviewItems).where(eq(reviewItems.status, "open")).groupBy(reviewItems.kind),
    db.select({ count: sql<number>`count(*)::int` }).from(userReports).where(eq(userReports.status, "open")),
    db.select({ status: jobRuns.status, count: sql<number>`count(*)::int` }).from(jobRuns).where(gte(jobRuns.startedAt, since24h)).groupBy(jobRuns.status),
    db.select().from(monitoringJobs).where(and(eq(monitoringJobs.enabled, true), sql`${monitoringJobs.attempts} > 0`)).orderBy(desc(monitoringJobs.attempts)).limit(10),
    db.select().from(connectors).orderBy(asc(connectors.key)),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8),
  ]);
  const stale = published.filter((o) => effectiveVerification({ state: o.state, verifiedAt: o.verifiedAt, riskTier: o.riskTier }, now).state === "stale");
  const unverified = published.filter((o) => o.state === "unverified");
  return {
    statusCounts: Object.fromEntries(statusCounts.map((r) => [r.status, r.count])) as Record<string, number>,
    publishedCount: published.length,
    stale,
    unverified,
    expiring,
    reviewCounts: Object.fromEntries(reviewCounts.map((r) => [r.kind, r.count])) as Record<string, number>,
    openReports: openReports[0]?.count ?? 0,
    runs24h: Object.fromEntries(runs.map((r) => [r.status, r.count])) as Record<string, number>,
    failingJobs,
    connectors: connectorRows,
    recentAudit,
  };
}

export async function recentJobRuns(limit = 40) {
  return db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(limit);
}

export async function recentObservations(limit = 40) {
  return db
    .select({ obs: sourceObservations, url: sources.url, offerTitle: offers.title, offerId: offers.id })
    .from(sourceObservations)
    .innerJoin(sources, eq(sources.id, sourceObservations.sourceId))
    .leftJoin(offers, eq(offers.id, sourceObservations.offerId))
    .orderBy(desc(sourceObservations.observedAt))
    .limit(limit);
}

export async function jobsWithTargets() {
  const jobs = await db.select().from(monitoringJobs).orderBy(asc(monitoringJobs.kind), asc(monitoringJobs.nextRunAt));
  const offerIds = jobs.filter((j) => j.kind === "offer_check" && j.targetId).map((j) => j.targetId!);
  const titles = offerIds.length ? await db.select({ id: offers.id, title: offers.title }).from(offers).where(inArray(offers.id, offerIds)) : [];
  const titleMap = new Map(titles.map((t) => [t.id, t.title]));
  return jobs.map((j) => ({ ...j, targetLabel: j.kind === "offer_check" ? (titleMap.get(j.targetId ?? "") ?? j.targetId) : (j.targetId ?? "system") }));
}
