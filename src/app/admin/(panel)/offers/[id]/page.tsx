import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addCouponAction,
  attachSourceAction,
  couponStatusAction,
  detachSourceAction,
  recordVerificationAction,
  setAvailabilityAction,
  setPublicationAction,
} from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import { Checkbox, enumOptions, Field, Select, TextArea, TextInput } from "@/components/admin/fields";
import OfferForm from "@/components/admin/OfferForm";
import StatusBadge from "@/components/offers/StatusBadge";
import { AVAILABILITIES, COUPON_STATUSES, SOURCE_TYPES, VERIFICATION_METHODS, VERIFICATION_STATES } from "@/lib/enums";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  AVAILABILITY_LABEL,
  COUPON_STATUS_LABEL,
  PUBLICATION_LABEL,
  SOURCE_TYPE_LABEL,
  VERIFICATION_LABEL,
  VERIFICATION_METHOD_LABEL,
} from "@/lib/labels";
import { canTransition } from "@/server/domain/lifecycle";
import { requirePageUser } from "@/server/auth/guard";
import { getAdminOffer, offerFormOptions } from "@/server/services/admin-offer-read";

export const metadata = { title: "Edit offer" };

const TRANSITIONS = [
  { to: "pending_review", label: "Submit for review", variant: "secondary" },
  { to: "published", label: "Publish", variant: "primary" },
  { to: "draft", label: "Move back to draft", variant: "secondary" },
  { to: "archived", label: "Archive", variant: "danger" },
] as const;

function Panel({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  // Suffixed so headings never collide with form field ids such as "availability".
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="bento-card grid gap-4 p-5">
      <h2 id={headingId} className="font-display text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function EditOfferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePageUser();
  const { id } = await params;
  const { created } = await searchParams;
  const [data, options] = await Promise.all([getAdminOffer(id), offerFormOptions()]);
  if (!data) notFound();
  const o = data.offer;
  const vLabel = VERIFICATION_LABEL[data.verification.state];

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link href="/admin/offers" className="text-sm text-link">
          ← Offers
        </Link>
        <h1 className="font-display text-3xl font-bold">{o.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge label={PUBLICATION_LABEL[o.publicationStatus]} tone={o.publicationStatus === "published" ? "positive" : "neutral"} />
          <StatusBadge label={AVAILABILITY_LABEL[o.availability].label} tone={AVAILABILITY_LABEL[o.availability].tone} />
          <StatusBadge label={vLabel.label} tone={vLabel.tone} />
          {o.isFixture ? <StatusBadge label="Fixture" tone="warning" /> : null}
          <span className="text-muted">
            {data.company.name} · updated {formatDateTime(o.updatedAt)}
          </span>
          {o.publicationStatus !== "draft" ? (
            <Link href={`/deals/${o.slug}`} className="text-link">
              View public page
            </Link>
          ) : null}
        </div>
        {created ? (
          <p className="rounded-lg bg-[var(--positive-bg)] px-3 py-2 text-sm text-positive" role="status">
            Draft created. Next: attach an official source, record verification, then publish.
          </p>
        ) : null}
      </header>

      {data.reviews.length ? (
        <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] p-4 text-sm">
          <p className="font-medium text-warning">Open review items</p>
          <ul className="mt-1 grid gap-1">
            {data.reviews.map((r) => (
              <li key={r.id}>
                {r.title} — <span className="text-muted">{r.details}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/review" className="mt-2 inline-block text-link">
            Resolve in the review queue
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Publication" id="publication">
          {data.problems.length && o.publicationStatus !== "published" ? (
            <div className="text-sm">
              <p className="text-muted">Publishing is blocked until:</p>
              <ul className="mt-1 list-inside list-disc text-warning">
                {data.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {TRANSITIONS.filter((t) => canTransition(o.publicationStatus, t.to)).map((t) => (
              <ActionForm key={t.to} action={setPublicationAction} submitLabel={t.label} variant={t.variant} inline confirmMessage={t.to === "archived" ? "Archive this offer? Its history is kept." : undefined}>
                <input type="hidden" name="offerId" value={o.id} />
                <input type="hidden" name="to" value={t.to} />
              </ActionForm>
            ))}
          </div>
          {o.publicationStatus === "published" && data.verification.state === "unverified" ? (
            <p className="text-xs text-caution">Published as unverified — the public page says so explicitly.</p>
          ) : null}
        </Panel>

        <Panel title="Availability" id="availability">
          <p className="text-sm text-muted">Expiry normally happens automatically from a confirmed end date. Change manually only with evidence; the note appears in the public history.</p>
          <ActionForm action={setAvailabilityAction} submitLabel="Update availability">
            <input type="hidden" name="offerId" value={o.id} />
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <Select name="availability" scope="availability-panel" aria-label="Availability" defaultValue={o.availability} options={enumOptions(AVAILABILITIES)} />
              <TextInput name="note" scope="availability-panel" aria-label="Reason and evidence" placeholder="Reason and evidence (required)" />
            </div>
          </ActionForm>
        </Panel>
      </div>

      <Panel title="Verification evidence" id="verification">
        <p className="text-sm text-muted">
          Current: <strong className={`ink-${vLabel.tone}`}>{vLabel.label}</strong>
          {o.verifiedAt ? ` · confirmed ${formatDate(o.verifiedAt)}` : ""} · goes stale after {data.verification.freshnessDays} days. “Redemption tested” requires a manual test in a named country. Automated page checks never create it.
        </p>
        <ActionForm action={recordVerificationAction} submitLabel="Record verification" resetOnSuccess>
          <input type="hidden" name="offerId" value={o.id} />
          <div className="grid gap-3 md:grid-cols-3">
            <Field scope="verification" label="State" name="state">
              <Select scope="verification" name="state" options={VERIFICATION_STATES.map((s) => ({ value: s, label: VERIFICATION_LABEL[s].label }))} />
            </Field>
            <Field scope="verification" label="Method" name="method">
              <Select scope="verification" name="method" options={VERIFICATION_METHODS.map((m) => ({ value: m, label: VERIFICATION_METHOD_LABEL[m] }))} />
            </Field>
            <Field scope="verification" label="Checked on" name="verifiedAt">
              <TextInput scope="verification" name="verifiedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field scope="verification" label="Evidence URL" name="evidenceUrl">
              <TextInput scope="verification" name="evidenceUrl" type="url" defaultValue={o.officialTermsUrl ?? ""} />
            </Field>
            <Field scope="verification" label="Country tested (redemption tests)" name="countryCode">
              <TextInput scope="verification" name="countryCode" placeholder="e.g. US" />
            </Field>
            <Field scope="verification" label="Coupon (optional)" name="couponId">
              <Select scope="verification" name="couponId" options={[{ value: "", label: "Whole offer" }, ...data.coupons.map((c) => ({ value: c.id, label: c.code }))]} />
            </Field>
          </div>
          <Field scope="verification" label="What was observed" name="note">
            <TextArea scope="verification" name="note" rows={2} placeholder="Short description of what the evidence shows (no long quotes)." />
          </Field>
        </ActionForm>
        {data.verifications.length ? (
          <ol className="grid gap-1.5 text-sm">
            {data.verifications.map((r) => (
              <li key={r.id} className="border-l-2 border-line pl-3">
                <strong>{VERIFICATION_LABEL[r.state].label}</strong> · {formatDate(r.verifiedAt)} · {VERIFICATION_METHOD_LABEL[r.method]}
                {r.countryCode ? ` · ${r.countryCode}` : ""}
                {r.note ? <span className="block text-xs text-muted">{r.note}</span> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Sources" id="sources">
          <ul className="grid gap-2 text-sm">
            {data.sources.map(({ source, role, expectedMarkers }) => (
              <li key={source.id} className="rounded-lg bg-surface-2 p-3">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-link">
                  {source.url}
                </a>
                <p className="mt-1 text-xs text-muted">
                  {SOURCE_TYPE_LABEL[source.sourceType]} · {role} {source.isOfficial ? "· official" : ""} · last outcome: {source.lastOutcome ?? "not checked"}
                  {source.consecutiveFailures ? ` · ${source.consecutiveFailures} failures` : ""}
                </p>
                {expectedMarkers.length ? <p className="mt-1 text-xs">Expected terms: {expectedMarkers.map((m) => `“${m}”`).join(", ")}</p> : <p className="mt-1 text-xs text-caution">No expected terms configured: checks confirm reachability only.</p>}
                <ActionForm action={detachSourceAction} submitLabel="Remove" variant="danger" inline confirmMessage="Remove this source from the offer?">
                  <input type="hidden" name="offerId" value={o.id} />
                  <input type="hidden" name="sourceId" value={source.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={attachSourceAction} submitLabel="Attach source" resetOnSuccess>
            <input type="hidden" name="offerId" value={o.id} />
            <Field scope="source" label="URL" name="url">
              <TextInput scope="source" name="url" type="url" required />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field scope="source" label="Type" name="sourceType">
                <Select scope="source" name="sourceType" options={SOURCE_TYPES.map((t) => ({ value: t, label: SOURCE_TYPE_LABEL[t] }))} />
              </Field>
              <Field scope="source" label="Role" name="role">
                <Select scope="source" name="role" options={enumOptions(["terms", "pricing", "student_terms", "coupon", "discovery", "supporting"] as const)} />
              </Field>
            </div>
            <Field scope="source" label="Title" name="title">
              <TextInput scope="source" name="title" />
            </Field>
            <Checkbox scope="source" name="isOfficial" label="Controlled by the company (official source)" />
            <Field scope="source" label="Expected terms on the page (one per line)" name="expectedMarkers" hint="Short phrases copied from the official page, e.g. “free for students”. Monitoring flags the offer for review when they disappear.">
              <TextArea scope="source" name="expectedMarkers" rows={2} hint />
            </Field>
          </ActionForm>
        </Panel>

        <Panel title="Coupon codes" id="coupons">
          {data.coupons.length ? (
            <ul className="grid gap-2 text-sm">
              {data.coupons.map((c) => (
                <li key={c.id} className="rounded-lg bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono font-semibold">{c.code}</code>
                    <StatusBadge label={COUPON_STATUS_LABEL[c.status].label} tone={COUPON_STATUS_LABEL[c.status].tone} size="xs" />
                  </div>
                  <ActionForm action={couponStatusAction} submitLabel="Update" inline variant="secondary">
                    <input type="hidden" name="couponId" value={c.id} />
                    <Select name="status" scope={`coupon-${c.id}`} aria-label={`Status of ${c.code}`} defaultValue={c.status} options={[...COUPON_STATUSES.map((s) => ({ value: s, label: COUPON_STATUS_LABEL[s].label })), { value: "remove", label: "Remove code" }]} />
                    <TextInput name="testCountry" scope={`coupon-${c.id}`} aria-label={`Country ${c.code} was tested in`} placeholder="Tested in (ISO)" />
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No codes recorded. Never add a code you have not seen on an official or authorized source.</p>
          )}
          <ActionForm action={addCouponAction} submitLabel="Add code" resetOnSuccess>
            <input type="hidden" name="offerId" value={o.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <Field scope="new-coupon" label="Code" name="code">
                <TextInput scope="new-coupon" name="code" required />
              </Field>
              <Field scope="new-coupon" label="Status" name="status">
                <Select scope="new-coupon" name="status" options={COUPON_STATUSES.map((s) => ({ value: s, label: COUPON_STATUS_LABEL[s].label }))} />
              </Field>
            </div>
            <Field scope="new-coupon" label="Where it was published (URL)" name="sourceUrl">
              <TextInput scope="new-coupon" name="sourceUrl" type="url" />
            </Field>
            <Field scope="new-coupon" label="Note" name="description">
              <TextInput scope="new-coupon" name="description" placeholder="e.g. Annual plans only" />
            </Field>
          </ActionForm>
        </Panel>
      </div>

      <section aria-labelledby="edit-heading" className="grid gap-4">
        <h2 id="edit-heading" className="font-display text-2xl font-semibold">
          Offer details
        </h2>
        <OfferForm companies={options.companies} categories={options.categories} values={data.values} offerId={o.id} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent automated checks" id="observations">
          {data.observations.length ? (
            <ul className="grid gap-1 text-sm">
              {data.observations.map((ob) => (
                <li key={ob.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {ob.outcome}
                    {ob.httpStatus ? ` (${ob.httpStatus})` : ""}
                    {ob.markersMissing.length ? ` · missing ${ob.markersMissing.length}` : ""}
                  </span>
                  <span className="text-muted">{formatDateTime(ob.observedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No checks yet. Published offers with an official source are checked on a schedule.</p>
          )}
        </Panel>
        <Panel title="History" id="revisions">
          <ol className="grid gap-1.5 text-sm">
            {data.revisions.map((r) => (
              <li key={r.id} className="border-l-2 border-line pl-3">
                <strong>{r.changeType.replace(/_/g, " ")}</strong> · {formatDateTime(r.changedAt)} · {r.actorLabel}
                {Object.keys(r.changes as object).length ? <span className="block truncate text-xs text-muted">{Object.keys(r.changes as object).join(", ")}</span> : null}
                {r.note ? <span className="block text-xs text-muted">{r.note}</span> : null}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
