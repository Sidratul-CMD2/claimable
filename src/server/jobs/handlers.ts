import { eq } from "drizzle-orm";
import type { JobKind } from "@/lib/enums";
import { db } from "../db";
import { connectors } from "../db/schema";
import { runPartnerFeed, type PartnerFeedConfig } from "../connectors/partner-feed";
import { runRssConnector, type RssConfig } from "../connectors/rss";
import { archiveExpired, checkOffer, expireOffers, MONITOR_CONNECTOR, staleScan } from "../services/monitoring";
import { openReviewItem } from "../services/review";
import type { JobOutcome, JobRow } from "./queue";
import { ensureRecurringJobs } from "./schedule";

const FAILURE_REVIEW_THRESHOLD = 3;

async function runConnector(key: string): Promise<JobOutcome> {
  const [connector] = await db.select().from(connectors).where(eq(connectors.key, key));
  if (!connector) return { status: "skipped", message: `Unknown connector ${key}` };
  if (!connector.enabled || connector.permissionStatus !== "approved") return { status: "skipped", message: "Connector disabled or not approved" };
  const now = new Date();

  let result: { ok: boolean; skipped?: boolean; message: string };
  if (key === MONITOR_CONNECTOR) {
    // Per-offer checks run as their own jobs; this keeps their schedule in sync.
    await ensureRecurringJobs(now);
    result = { ok: true, message: "Offer check jobs synchronised" };
  } else if (key === "rss-announcements") {
    result = await runRssConnector(key, connector.config as RssConfig, now);
  } else if (key === "partner-json-feed") {
    result = await runPartnerFeed(key, connector.config as PartnerFeedConfig, now);
  } else {
    return { status: "skipped", message: `No implementation for ${key}` };
  }

  const failures = result.ok ? 0 : connector.consecutiveFailures + 1;
  await db
    .update(connectors)
    .set({ lastRunAt: now, consecutiveFailures: failures, lastError: result.ok ? null : result.message.slice(0, 500), ...(result.ok && !result.skipped ? { lastSuccessAt: now } : {}) })
    .where(eq(connectors.key, key));
  if (failures >= FAILURE_REVIEW_THRESHOLD) {
    await openReviewItem(db, {
      kind: "repeated_failures",
      priority: 2,
      title: `Connector failing: ${connector.name}`,
      details: `${failures} consecutive failed runs. Last error: ${result.message}`,
      dedupeKey: `connector:${key}`,
    });
  }
  return { status: result.ok ? (result.skipped ? "skipped" : "success") : "failure", message: result.message, retry: !result.ok };
}

export const handlers: Record<JobKind, (job: JobRow) => Promise<JobOutcome>> = {
  offer_check: (job) => checkOffer(job.targetId!),
  connector_run: (job) => runConnector(job.targetId!),
  expire_offers: () => expireOffers(),
  archive_expired: () => archiveExpired(),
  stale_scan: () => staleScan(),
};
