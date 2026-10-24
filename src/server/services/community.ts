/**
 * Visitor reports and deal submissions. Both enter human review; neither changes an offer's
 * status by itself (brief §16, §21). Abuse controls: rate limits, per-fingerprint dedupe,
 * honeypot field, and escalation only when several distinct visitors agree.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { REPORT_REASONS } from "@/lib/enums";
import { REPORT_REASON_LABEL } from "@/lib/labels";
import { isCountryCode } from "@/lib/countries";
import { db } from "../db";
import { coupons, offers, reviewItems, submissions, userReports } from "../db/schema";
import { isSafePublicUrl } from "../domain/url-safety";
import { consumeRateLimit } from "../security/rate-limit";
import { recordEvent } from "./analytics";
import { publicOfferWhere } from "./bundles";

export const ESCALATION_DISTINCT_REPORTERS = 3;

const reportSchema = z.object({
  offerSlug: z.string().min(1).max(140),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).default(""),
  countryCode: z.preprocess((v) => (v === "" ? null : v), z.string().length(2).toUpperCase().refine(isCountryCode).nullable().default(null)),
  couponCode: z.preprocess((v) => (v === "" ? null : v), z.string().max(64).nullable().default(null)),
  website: z.string().max(500).optional(), // honeypot: humans leave it empty; bots are dropped silently
});

export type CommunityResult = { ok: true; message: string } | { ok: false; error: string };

export async function submitReport(raw: unknown, fingerprint: string): Promise<CommunityResult> {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please choose what went wrong." };
  if (parsed.data.website) return { ok: true, message: "Thanks — your report was received." }; // bot: silently drop
  const limit = await consumeRateLimit(`report:${fingerprint}`, 5, 3600);
  if (!limit.allowed) return { ok: false, error: "You've sent several reports recently. Please try again later." };

  const [offer] = await db
    .select({ id: offers.id, title: offers.title })
    .from(offers)
    .where(and(eq(offers.slug, parsed.data.offerSlug), publicOfferWhere({ includeExpired: true, includeArchived: true })))
    .limit(1);
  if (!offer) return { ok: false, error: "This offer is no longer available." };

  let couponId: string | null = null;
  if (parsed.data.couponCode) {
    const [c] = await db.select({ id: coupons.id }).from(coupons).where(and(eq(coupons.offerId, offer.id), eq(coupons.code, parsed.data.couponCode))).limit(1);
    couponId = c?.id ?? null;
  }

  const since = new Date(Date.now() - 7 * 86_400_000);
  const [duplicate] = await db
    .select({ id: userReports.id })
    .from(userReports)
    .where(and(eq(userReports.offerId, offer.id), eq(userReports.reason, parsed.data.reason), eq(userReports.fingerprint, fingerprint), gte(userReports.createdAt, since)))
    .limit(1);
  if (duplicate) return { ok: true, message: "Thanks — we already have your report about this and it's in our review queue." };

  await db.transaction(async (tx) => {
    await tx.insert(userReports).values({
      offerId: offer.id,
      couponId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      countryCode: parsed.data.countryCode,
      fingerprint,
    });
    const [{ reporters }] = await tx
      .select({ reporters: sql<number>`count(distinct ${userReports.fingerprint})::int` })
      .from(userReports)
      .where(and(eq(userReports.offerId, offer.id), eq(userReports.reason, parsed.data.reason), eq(userReports.status, "open"), gte(userReports.createdAt, since)));
    const priority = reporters >= ESCALATION_DISTINCT_REPORTERS ? 1 : 3;
    const title = `${REPORT_REASON_LABEL[parsed.data.reason]}: ${offer.title}`;
    const details = `${reporters} distinct visitor${reporters === 1 ? "" : "s"} reported this in the last 7 days. Offer status is unchanged until reviewed.`;
    await tx
      .insert(reviewItems)
      .values({ kind: "user_reports", priority, offerId: offer.id, title, details, dedupeKey: `reports:${offer.id}:${parsed.data.reason}`, payload: { reason: parsed.data.reason, reporters } })
      .onConflictDoUpdate({
        target: reviewItems.dedupeKey,
        targetWhere: sql`status = 'open'`,
        set: { priority, details, updatedAt: new Date(), payload: { reason: parsed.data.reason, reporters } },
      });
  });
  await recordEvent({ type: "report", offerId: offer.id, countryCode: parsed.data.countryCode });
  return { ok: true, message: "Thanks — your report is in our review queue. We don't change an offer's status based on a single report." };
}

const submissionSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  productName: z.string().trim().max(120).optional().default(""),
  offerUrl: z.string().trim().max(2000).refine(isSafePublicUrl, "Enter the official https link to the offer."),
  couponCode: z.string().trim().max(64).optional().default(""),
  benefit: z.string().trim().min(3).max(300),
  countryRestrictions: z.string().trim().max(300).optional().default(""),
  expiresOn: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null)),
  evidence: z.string().trim().max(2000).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  website: z.string().max(500).optional(), // honeypot
});

export async function submitDeal(raw: unknown, fingerprint: string): Promise<CommunityResult & { fieldErrors?: Record<string, string> }> {
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  if (parsed.data.website) return { ok: true, message: "Thanks — your submission was received." };
  const limit = await consumeRateLimit(`submit:${fingerprint}`, 5, 3600);
  if (!limit.allowed) return { ok: false, error: "You've submitted several deals recently. Please try again later." };
  const d = parsed.data;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(submissions)
      .values({
        companyName: d.companyName,
        productName: d.productName || null,
        offerUrl: d.offerUrl,
        couponCode: d.couponCode || null,
        benefit: d.benefit,
        countryRestrictions: d.countryRestrictions || null,
        expiresOn: d.expiresOn,
        evidence: d.evidence || null,
        notes: d.notes || null,
        fingerprint,
      })
      .returning();
    await tx.insert(reviewItems).values({
      kind: "submission",
      priority: 3,
      title: `Community submission: ${d.companyName} — ${d.benefit.slice(0, 80)}`,
      details: "Unverified community submission. Verify against an official source before creating an offer.",
      dedupeKey: `submission:${row.id}`,
      payload: { submissionId: row.id, url: d.offerUrl },
    });
  });
  await recordEvent({ type: "submission" });
  return { ok: true, message: "Thanks! Your submission is in our review queue. It will only be published after we verify it with an official source." };
}
