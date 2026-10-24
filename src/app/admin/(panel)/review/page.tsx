import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { resolveReviewItemAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Select, TextInput } from "@/components/admin/fields";
import { REVIEW_KINDS, type ReviewKind } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { REPORT_REASON_LABEL } from "@/lib/labels";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { discoveryCandidates, offers, reviewItems, submissions, userReports } from "@/server/db/schema";

export const metadata = { title: "Review queue" };

const PRIORITY = { 1: "High", 2: "Normal", 3: "Low" } as Record<number, string>;

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePageUser();
  const { kind } = await searchParams;
  const filterKind = REVIEW_KINDS.includes(kind as ReviewKind) ? (kind as ReviewKind) : undefined;
  const items = await db
    .select({ item: reviewItems, offerTitle: offers.title, offerSlug: offers.slug })
    .from(reviewItems)
    .leftJoin(offers, eq(offers.id, reviewItems.offerId))
    .where(and(eq(reviewItems.status, "open"), filterKind ? eq(reviewItems.kind, filterKind) : undefined))
    .orderBy(asc(reviewItems.priority), desc(reviewItems.updatedAt))
    .limit(200);

  const offerIds = items.map((i) => i.item.offerId).filter((x): x is string => !!x);
  const submissionIds = items.map((i) => (i.item.payload as { submissionId?: string } | null)?.submissionId).filter((x): x is string => !!x);
  const candidateIds = items.map((i) => (i.item.payload as { candidateId?: string } | null)?.candidateId).filter((x): x is string => !!x);
  const [reports, subs, candidates, resolved] = await Promise.all([
    offerIds.length ? db.select().from(userReports).where(and(inArray(userReports.offerId, offerIds), eq(userReports.status, "open"))).orderBy(desc(userReports.createdAt)) : [],
    submissionIds.length ? db.select().from(submissions).where(inArray(submissions.id, submissionIds)) : [],
    candidateIds.length ? db.select().from(discoveryCandidates).where(inArray(discoveryCandidates.id, candidateIds)) : [],
    db.select().from(reviewItems).where(inArray(reviewItems.status, ["resolved", "dismissed"])).orderBy(desc(reviewItems.resolvedAt)).limit(15),
  ]);

  const kinds = [...new Set(items.map((i) => i.item.kind))];
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Review queue</h1>
        <p className="text-sm text-muted">Monitoring findings, visitor reports, submissions and discovery signals. Nothing here changes an offer until someone acts on it.</p>
      </header>
      <nav aria-label="Filter by kind" className="flex flex-wrap gap-1">
        <Link href="/admin/review" aria-current={!filterKind ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm ${!filterKind ? "bg-surface-3" : "text-muted"}`}>
          All ({items.length})
        </Link>
        {kinds.map((k) => (
          <Link key={k} href={`/admin/review?kind=${k}`} aria-current={filterKind === k ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm capitalize ${filterKind === k ? "bg-surface-3" : "text-muted"}`}>
            {k.replace(/_/g, " ")}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? <p className="rounded-xl border border-line p-6 text-sm text-muted">The queue is empty.</p> : null}
      <ul className="grid gap-4">
        {items.map(({ item, offerTitle }) => {
          const payload = (item.payload ?? {}) as { reason?: string; submissionId?: string; candidateId?: string; url?: string };
          const itemReports = item.kind === "user_reports" ? reports.filter((r) => r.offerId === item.offerId && (!payload.reason || r.reason === payload.reason)) : [];
          const sub = subs.find((s) => s.id === payload.submissionId);
          const cand = candidates.find((c) => c.id === payload.candidateId);
          return (
            <li key={item.id} className="bento-card grid gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${item.priority === 1 ? "tone-negative" : item.priority === 2 ? "tone-caution" : "tone-neutral"}`}>{PRIORITY[item.priority]}</span>
                <span className="capitalize text-muted">{item.kind.replace(/_/g, " ")}</span>
                <span className="text-subtle">opened {formatDateTime(item.createdAt)}</span>
              </div>
              <h2 className="font-medium">{item.title}</h2>
              <p className="text-sm text-muted">{item.details}</p>
              {item.offerId ? (
                <p className="text-sm">
                  Offer:{" "}
                  <Link href={`/admin/offers/${item.offerId}`} className="text-link">
                    {offerTitle}
                  </Link>
                </p>
              ) : null}
              {payload.url ? (
                <a href={payload.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-link">
                  {payload.url}
                </a>
              ) : null}
              {itemReports.length ? (
                <ul className="grid gap-1 rounded-lg bg-surface-2 p-3 text-xs">
                  {itemReports.slice(0, 10).map((r) => (
                    <li key={r.id}>
                      {REPORT_REASON_LABEL[r.reason]} · {r.countryCode ?? "no country"} · {formatDateTime(r.createdAt)}
                      {r.details ? <span className="block text-muted">“{r.details}”</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {sub ? (
                <dl className="grid gap-1 rounded-lg bg-surface-2 p-3 text-xs">
                  <div>
                    <dt className="inline text-muted">Company: </dt>
                    <dd className="inline">{sub.companyName}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Benefit: </dt>
                    <dd className="inline">{sub.benefit}</dd>
                  </div>
                  {sub.couponCode ? (
                    <div>
                      <dt className="inline text-muted">Code (unverified): </dt>
                      <dd className="inline font-mono">{sub.couponCode}</dd>
                    </div>
                  ) : null}
                  {sub.countryRestrictions ? <div>Countries: {sub.countryRestrictions}</div> : null}
                  {sub.expiresOn ? <div>Expires: {sub.expiresOn}</div> : null}
                  {sub.evidence ? <div>Evidence: {sub.evidence}</div> : null}
                  {sub.notes ? <div>Notes: {sub.notes}</div> : null}
                </dl>
              ) : null}
              {cand ? (
                <p className="text-xs text-muted">
                  Matched keywords: {cand.matchedKeywords.join(", ") || "—"} · published {cand.publishedAt ? formatDateTime(cand.publishedAt) : "unknown"}
                </p>
              ) : null}
              <ActionForm action={resolveReviewItemAction} submitLabel="Close item" inline variant="secondary">
                <input type="hidden" name="id" value={item.id} />
                <Select name="status" scope={item.id} aria-label="Outcome" options={[{ value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }]} />
                {item.kind === "user_reports" ? (
                  <Select name="reportOutcome" scope={item.id} aria-label="Report outcome" options={[{ value: "invalid", label: "Reports not confirmed" }, { value: "valid", label: "Reports confirmed (offer corrected)" }]} />
                ) : null}
                {item.kind === "submission" ? (
                  <Select name="submissionOutcome" scope={item.id} aria-label="Submission outcome" options={[{ value: "rejected", label: "Reject submission" }, { value: "accepted", label: "Accepted (offer created)" }]} />
                ) : null}
                {item.kind === "discovery_candidate" ? (
                  <Select name="candidateOutcome" scope={item.id} aria-label="Discovery outcome" options={[{ value: "dismissed", label: "Not a usable promotion" }, { value: "promoted", label: "Promoted to an offer" }]} />
                ) : null}
                <TextInput name="note" scope={item.id} aria-label="Resolution note" placeholder="Resolution note (required)" />
              </ActionForm>
              {item.kind === "submission" || item.kind === "discovery_candidate" ? (
                <Link href="/admin/offers/new" className="text-xs text-link">
                  Create a draft offer from this (verify on an official page first) →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {resolved.length ? (
        <section aria-labelledby="resolved">
          <h2 id="resolved" className="text-sm font-semibold uppercase tracking-wider text-subtle">
            Recently closed
          </h2>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {resolved.map((r) => (
              <li key={r.id}>
                {r.status} · {r.title} — {r.resolutionNote}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
