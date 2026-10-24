/**
 * Keeps the durable job table in sync with what should be monitored.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { connectors, monitoringJobs, offerSources, offers, sources } from "../db/schema";
import { offerCheckIntervalMinutes } from "../domain/monitoring";

export const SYSTEM_JOBS = [
  { kind: "expire_offers" as const, uniqueKey: "system:expire_offers", intervalMinutes: 60, timeoutSeconds: 120 },
  { kind: "archive_expired" as const, uniqueKey: "system:archive_expired", intervalMinutes: 24 * 60, timeoutSeconds: 120 },
  { kind: "stale_scan" as const, uniqueKey: "system:stale_scan", intervalMinutes: 24 * 60, timeoutSeconds: 120 },
];

/** Upserts the per-offer check job, or disables it when the offer should not be monitored. */
export async function syncOfferCheckJob(tx: DbOrTx, offerId: string, now: Date = new Date()) {
  const [offer] = await tx.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  const uniqueKey = `offer_check:${offerId}`;
  if (!offer) return;
  const [{ official }] = await tx
    .select({ official: sql<number>`count(*)::int` })
    .from(offerSources)
    .innerJoin(sources, eq(sources.id, offerSources.sourceId))
    .where(and(eq(offerSources.offerId, offerId), eq(sources.isOfficial, true)));
  const shouldMonitor = offer.publicationStatus === "published" && offer.availability !== "expired" && official > 0 && !offer.isFixture;
  const intervalMinutes = offerCheckIntervalMinutes(offer, now);
  await tx
    .insert(monitoringJobs)
    .values({
      kind: "offer_check",
      targetId: offerId,
      uniqueKey,
      intervalMinutes,
      nextRunAt: new Date(now.getTime() + 60_000),
      enabled: shouldMonitor,
      timeoutSeconds: 60,
    })
    .onConflictDoUpdate({
      target: monitoringJobs.uniqueKey,
      set: { intervalMinutes, enabled: shouldMonitor, updatedAt: now },
    });
}

/** Ensures system and connector jobs exist; safe to call on every worker start. */
export async function ensureRecurringJobs(now: Date = new Date()) {
  for (const job of SYSTEM_JOBS) {
    await db
      .insert(monitoringJobs)
      .values({ ...job, targetId: null, nextRunAt: now, enabled: true })
      .onConflictDoNothing({ target: monitoringJobs.uniqueKey });
  }
  const connectorRows = await db.select().from(connectors);
  for (const c of connectorRows) {
    const enabled = c.enabled && c.permissionStatus === "approved";
    await db
      .insert(monitoringJobs)
      .values({
        kind: "connector_run",
        targetId: c.key,
        uniqueKey: `connector:${c.key}`,
        intervalMinutes: c.intervalMinutes,
        nextRunAt: now,
        enabled,
        timeoutSeconds: 300,
      })
      .onConflictDoUpdate({
        target: monitoringJobs.uniqueKey,
        set: { intervalMinutes: c.intervalMinutes, enabled, updatedAt: now },
      });
  }
  // Offer checks for every published offer with an official source.
  const published = await db.select({ id: offers.id }).from(offers).where(eq(offers.publicationStatus, "published"));
  for (const o of published) await syncOfferCheckJob(db, o.id, now);
}
