"use client";

import { useActionState } from "react";
import { submitDealAction, type FormState } from "@/app/actions/community";
import { useKeepValuesSubmit } from "@/components/use-keep-values-submit";

const input = "h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm aria-[invalid=true]:border-[var(--negative)]";

function Row({ name, label, hint, error, children }: { name: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function SubmitForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitDealAction, null);
  const submit = useKeepValuesSubmit(action);
  const e = state?.fieldErrors ?? {};
  if (state?.ok) {
    return (
      <p className="rounded-2xl border border-[var(--positive)]/40 bg-[var(--positive-bg)] p-5 text-positive" role="status">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} onSubmit={submit} className="grid gap-4">
      <div aria-hidden="true" className="hidden">
        <label>
          Leave empty <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Row name="companyName" label="Company" error={e.companyName}>
          <input id="companyName" name="companyName" required maxLength={120} aria-invalid={!!e.companyName} className={input} />
        </Row>
        <Row name="productName" label="Product (optional)">
          <input id="productName" name="productName" maxLength={120} className={input} />
        </Row>
      </div>
      <Row name="offerUrl" label="Official offer link" hint="The merchant's own page for the offer, if possible." error={e.offerUrl}>
        <input id="offerUrl" name="offerUrl" type="url" required placeholder="https://" aria-invalid={!!e.offerUrl} className={input} />
      </Row>
      <Row name="benefit" label="What does it give?" hint="e.g. “50% off the first year for new customers”" error={e.benefit}>
        <input id="benefit" name="benefit" required maxLength={300} aria-invalid={!!e.benefit} className={input} />
      </Row>
      <div className="grid gap-4 md:grid-cols-3">
        <Row name="couponCode" label="Coupon code (if any)">
          <input id="couponCode" name="couponCode" maxLength={64} className={input} />
        </Row>
        <Row name="countryRestrictions" label="Country restrictions">
          <input id="countryRestrictions" name="countryRestrictions" maxLength={300} placeholder="e.g. US only" className={input} />
        </Row>
        <Row name="expiresOn" label="Ends on (if known)" error={e.expiresOn}>
          <input id="expiresOn" name="expiresOn" type="date" className={input} />
        </Row>
      </div>
      <Row name="evidence" label="Evidence (optional)" hint="Where you saw it — a link or a short description. Please don't include personal information.">
        <textarea id="evidence" name="evidence" rows={3} maxLength={2000} className={`${input} h-auto py-2`} />
      </Row>
      <Row name="notes" label="Notes (optional)">
        <textarea id="notes" name="notes" rows={2} maxLength={1000} className={`${input} h-auto py-2`} />
      </Row>
      {state && !state.ok ? (
        <p className="text-sm text-negative" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="h-11 justify-self-start rounded-full bg-fg px-5 text-sm font-medium text-[var(--ink-on-light)] hover:bg-white disabled:opacity-60">
        {pending ? "Sending…" : "Submit for review"}
      </button>
    </form>
  );
}
