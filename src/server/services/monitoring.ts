/**
 * Scheduled monitoring use cases. None of these can expire an offer because a page failed
 * or changed — they record observations and open review items. Expiry comes only from a
 * confirmed end date (expireOffers) or a human decision.
 */
import { and, asc, desc, eq, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { db } from "../db";
import { companies, connectors, offerRevisions, offerSources, offers, promotionalEvents, sourceObservations, sources, verificationRecords } from "../db/schema";
import { expiryDecision, shouldArchive } from "../domain/lifecycle";
import { interpretCheck, normalizeForMatching, offerCheckIntervalMinutes } from "../domain/monitoring";
import { automatedCheckRefreshesVerification, effectiveVerification } from "../domain/verification";
import { politeFetch } from "../connectors/http";
import { syncOfferCheckJob } from "../jobs/schedule";
import type { JobOutcome } from "../jobs/queue";
import { setPublicationStatus } from "./admin-offers";
import { SYSTEM_ACTOR, writeAudit, writeRevision } from "./audit";
import { openReviewItem } from "./review";

export const MONITOR_CONNECTOR = "official-page-monitor";
const MAX_SOURCES_PER_CHECK = 3;

/** A short quote around the first matched marker (evidence without copying the page). */
function excerptAround(text: string | null, marker: string | undefined): string | null {
  if (!text || !marker) return null;
  const flat = text.replace(/\s+/g, " ");
  const index = normalizeForMatching(flat).indexOf(normalizeForMatching(marker));
  if (index < 0) return null;
  return flat.slice(Math.max(0, index - 80), index + marker.length + 80).trim();
}

export async function checkOffer(offerId: string, now: Date = new Date()): Promise<JobOutcome> {
  const [offer] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  if (!offer || offer.publicationStatus !== "published" || offer.availability === "expired" || offer.isFixture) {
    if (offer) await syncOfferCheckJob(db, offer.id, now);
    return { status: "skipped", message: "Offer is not a published, monitorable offer." };
  }
  const official = await db
    .select({ source: sources, markers: offerSources.expectedMarkers })
    .from(offerSources)
    .innerJoin(sources, eq(sources.id, offerSources.sourceId))
    .where(and(eq(offerSources.offerId, offerId), eq(sources.isOfficial, true)))
    .orderBy(asc(sources.firstDiscoveredAt))
    .limit(MAX_SOURCES_PER_CHECK);
  if (!official.length) return { status: "skipped", message: "No official source attached." };

  let retrievedAny = false;
  let transientFailures = 0;
  let refreshObservationId = null as string | null;
  const outcomes: string[] = [];

  for (const { source, markers } of official) {
    const fetched = await politeFetch(source.url);
    const decision = interpretCheck(fetched.result, {
      sourceUrl: source.url,
      previousHash: source.lastContentHash,
      expectedMarkers: markers,
      consecutiveFailures: source.consecutiveFailures,
    });
    outcomes.push(`${new URL(source.url).hostname}: ${decision.outcome}`);
    const response = fetched.result.kind === "response" ? fetched.result : null;
    const errorText = "error" in fetched.result ? fetched.result.error : null;

    await db.transaction(async (tx) => {
      const [observation] = await tx
        .insert(sourceObservations)
        .values({
          sourceId: source.id,
          offerId,
          connectorKey: MONITOR_CONNECTOR,
          observedAt: now,
          outcome: decision.outcome,
          httpStatus: response?.httpStatus ?? null,
          finalUrl: response?.finalUrl ?? null,
          contentHash: response?.contentHash ?? null,
          markersFound: decision.markersFound,
          markersMissing: decision.markersMissing,
          excerpt: excerptAround(response?.text ?? null, decision.markersFound[0]),
          errorMessage: errorText,
          durationMs: fetched.durationMs,
        })
        .returning({ id: sourceObservations.id });
      await tx
        .update(sources)
        .set({
          lastCheckedAt: now,
          lastOutcome: decision.outcome,
          lastHttpStatus: response?.httpStatus ?? null,
          ...(decision.retrieved ? { lastSuccessAt: now, lastContentHash: response?.contentHash ?? null, consecutiveFailures: 0 } : {}),
          ...(decision.countsAsFailure ? { consecutiveFailures: source.consecutiveFailures + 1 } : {}),
        })
        .where(eq(sources.id, source.id));
      for (const review of decision.reviews) {
        await openReviewItem(tx, { ...review, offerId, sourceId: source.id, dedupeKey: `${review.kind}:${offerId}:${source.id}`, payload: { observationId: observation.id, url: source.url } });
      }
      if (
        decision.retrieved &&
        automatedCheckRefreshesVerification({
          state: offer.verificationState,
          sourceIsOfficial: source.isOfficial,
          markersConfigured: markers.length,
          markersMissing: decision.markersMissing.length,
        })
      ) {
        refreshObservationId = observation.id;
      }
    });
    if (decision.retrieved) retrievedAny = true;
    if (decision.retry) transientFailures++;
  }

  await db.transaction(async (tx) => {
    await tx.update(offers).set({ lastCheckedAt: now, ...(refreshObservationId ? { verifiedAt: now } : {}) }).where(eq(offers.id, offerId));
    if (refreshObservationId) {
      await tx.insert(verificationRecords).values({
        offerId,
        state: offer.verificationState,
        method: "automated_official_page_check",
        evidenceUrl: official[0].source.url,
        note: "All expected terms were present on the official page.",
        observationId: refreshObservationId,
        verifiedAt: now,
      });
    }
    await tx
      .update(connectors)
      .set({ lastRunAt: now, ...(retrievedAny ? { lastSuccessAt: now, consecutiveFailures: 0, lastError: null } : {}) })
      .where(eq(connectors.key, MONITOR_CONNECTOR));
  });

  const nextIntervalMinutes = offerCheckIntervalMinutes(offer, now);
  if (!retrievedAny && transientFailures === official.length) {
    return { status: "failure", retry: true, message: outcomes.join("; "), nextIntervalMinutes };
  }
  return { status: "success", message: outcomes.join("; "), stats: { sources: official.length, refreshed: !!refreshObservationId }, nextIntervalMinutes };
}

export async function expireOffers(now: Date = new Date()): Promise<JobOutcome> {
  const due = await db
    .select({ offer: offers, company: companies.name })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .where(and(eq(offers.publicationStatus, "published"), ne(offers.availability, "expired"), isNotNull(offers.endsAt), lte(offers.endsAt, now)));
  let expired = 0;
  let flagged = 0;
  for (const { offer, company } of due) {
    const decision = expiryDecision(offer, now);
    if (decision === "expire") {
      await db.transaction(async (tx) => {
        await tx.update(offers).set({ availability: "expired", updatedAt: now }).where(eq(offers.id, offer.id));
        await writeRevision(tx, offer.id, SYSTEM_ACTOR, "expired", { availability: { from: offer.availability, to: "expired" } }, "Confirmed end date passed.");
        await writeAudit(tx, SYSTEM_ACTOR, "offer.expire", "offer", offer.id, { availability: offer.availability }, { availability: "expired" });
        // Preserve the observed promotion as a historical calendar record (unpublished until an editor reviews it).
        const [firstSource] = await tx
          .select({ url: sources.url })
          .from(offerSources)
          .innerJoin(sources, eq(sources.id, offerSources.sourceId))
          .where(eq(offerSources.offerId, offer.id))
          .limit(1);
        const sourceUrl = offer.officialTermsUrl ?? firstSource?.url;
        if (sourceUrl) {
          await tx.insert(promotionalEvents).values({
            companyId: offer.companyId,
            offerId: offer.id,
            title: `${company}: ${offer.benefit}`,
            kind: "historical",
            occasion: "other",
            startsOn: (offer.startsAt ?? offer.publishedAt ?? offer.createdAt).toISOString().slice(0, 10),
            endsOn: offer.endsAt!.toISOString().slice(0, 10),
            datesApproximate: !offer.startsAt,
            sourceUrl,
            evidenceNote: `Recorded from a tracked offer that expired on its confirmed end date.${offer.startsAt ? "" : " Start date is when tracking began, not necessarily when the promotion started."}`,
            isPublished: false,
            isFixture: offer.isFixture,
          });
        }
        await syncOfferCheckJob(tx, offer.id, now);
      });
      expired++;
    } else if (decision === "flag_unconfirmed_end") {
      const opened = await openReviewItem(db, {
        kind: "unconfirmed_end_date_passed",
        priority: 2,
        offerId: offer.id,
        title: `Unconfirmed end date passed: ${company}`,
        details: `The recorded end date (${offer.endsAt!.toISOString().slice(0, 10)}) was not confirmed by an official source, so the offer was not expired automatically. Check the merchant's page.`,
        dedupeKey: `unconfirmed_end:${offer.id}`,
      });
      if (opened) flagged++;
    }
  }
  return { status: "success", message: `${expired} expired, ${flagged} flagged for review`, stats: { expired, flagged } };
}

export async function archiveExpired(now: Date = new Date()): Promise<JobOutcome> {
  const candidates = await db.select().from(offers).where(and(eq(offers.publicationStatus, "published"), eq(offers.availability, "expired")));
  if (!candidates.length) return { status: "success", message: "0 archived", stats: { archived: 0 } };
  const expiryRevisions = await db
    .select({ offerId: offerRevisions.offerId, changedAt: offerRevisions.changedAt, changes: offerRevisions.changes })
    .from(offerRevisions)
    .where(inArray(offerRevisions.offerId, candidates.map((c) => c.id)))
    .orderBy(desc(offerRevisions.changedAt));
  let archived = 0;
  for (const offer of candidates) {
    const rev = expiryRevisions.find((r) => r.offerId === offer.id && (r.changes as Record<string, { to?: unknown }>).availability?.to === "expired");
    const expiredSince = rev?.changedAt ?? (offer.endsAtConfirmed ? offer.endsAt : null);
    if (shouldArchive({ availability: offer.availability, publicationStatus: offer.publicationStatus, expiredSince }, now)) {
      const result = await setPublicationStatus(SYSTEM_ACTOR, offer.id, "archived", "Archived automatically 30 days after expiry; history retained.");
      if (result.ok) archived++;
    }
  }
  return { status: "success", message: `${archived} archived`, stats: { archived } };
}

export async function staleScan(now: Date = new Date()): Promise<JobOutcome> {
  const published = await db
    .select({ id: offers.id, title: offers.title, state: offers.verificationState, verifiedAt: offers.verifiedAt, riskTier: offers.riskTier, isFixture: offers.isFixture })
    .from(offers)
    .where(and(eq(offers.publicationStatus, "published"), ne(offers.availability, "expired")));
  let opened = 0;
  for (const o of published) {
    if (o.isFixture) continue;
    const decision = effectiveVerification({ state: o.state, verifiedAt: o.verifiedAt, riskTier: o.riskTier }, now);
    if (decision.state !== "stale") continue;
    const created = await openReviewItem(db, {
      kind: "stale_verification",
      priority: 2,
      offerId: o.id,
      title: `Verification stale: ${o.title}`,
      details: `Last confirmed ${o.verifiedAt?.toISOString().slice(0, 10) ?? "never"}; the freshness window is ${decision.freshnessDays} days. The public page already shows "Verification stale". Re-check the official terms and record new evidence.`,
      dedupeKey: `stale:${o.id}`,
    });
    if (created) opened++;
  }
  return { status: "success", message: `${opened} stale offers queued for review`, stats: { opened } };
}
