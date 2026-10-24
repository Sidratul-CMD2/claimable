"use client";

import { Flag } from "lucide-react";
import { useActionState, useId } from "react";
import { reportProblemAction, type FormState } from "@/app/actions/community";
import { REPORT_REASON_LABEL } from "@/lib/labels";
import { REPORT_REASONS } from "@/lib/enums";
import { useKeepValuesSubmit } from "@/components/use-keep-values-submit";

export default function ReportForm({ slug, country, couponCodes }: { slug: string; country: string | null; couponCodes: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportProblemAction, null);
  const submit = useKeepValuesSubmit(action);
  const id = useId();
  return (
    <details className="group rounded-2xl border border-line bg-surface p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Flag className="size-4 text-subtle" aria-hidden="true" />
        Report a problem with this offer
      </summary>
      {state?.ok ? (
        <p className="mt-3 text-sm text-positive" role="status">
          {state.message}
        </p>
      ) : (
        <form action={action} onSubmit={submit} className="mt-3 grid gap-3">
          <input type="hidden" name="offerSlug" value={slug} />
          <input type="hidden" name="countryCode" value={country ?? ""} />
          <div aria-hidden="true" className="hidden">
            <label>
              Leave empty <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm text-muted">What went wrong?</legend>
            {REPORT_REASONS.map((reason) => (
              <label key={reason} className="flex min-h-9 items-center gap-2.5 text-sm">
                <input type="radio" name="reason" value={reason} required className="size-4 accent-[var(--orb-cyan)]" />
                {REPORT_REASON_LABEL[reason]}
              </label>
            ))}
          </fieldset>
          {couponCodes.length ? (
            <label className="grid gap-1 text-sm text-muted">
              Which code? (optional)
              <select name="couponCode" className="h-10 rounded-lg border border-line bg-surface-2 px-2 text-fg">
                <option value="">Not about a specific code</option>
                {couponCodes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label htmlFor={`${id}-details`} className="text-sm text-muted">
            Details (optional) — please don&apos;t include personal information
          </label>
          <textarea id={`${id}-details`} name="details" maxLength={1000} rows={3} className="rounded-lg border border-line bg-surface-2 p-2 text-sm" />
          {state && !state.ok ? (
            <p className="text-sm text-warning" role="alert">
              {state.error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="h-10 justify-self-start rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-surface-3 disabled:opacity-60">
            {pending ? "Sending…" : "Send report"}
          </button>
          <p className="text-xs text-subtle">Reports go to our review queue. One report never changes an offer&apos;s status on its own.</p>
        </form>
      )}
    </details>
  );
}
