"use client";

import { useActionState, useMemo, useState } from "react";
import { saveOfferAction, type ActionState } from "@/app/admin/actions";
import { useKeepValuesSubmit } from "@/components/use-keep-values-submit";
import {
  AVAILABILITIES,
  BILLING_INTERVALS,
  CONDITION_KINDS,
  COUNTRY_STATUSES,
  CUSTOMER_ELIGIBILITIES,
  OFFER_TYPES,
  PLATFORMS,
  RISK_TIERS,
  STUDENT_ACTIONS,
  TRI_STATES,
} from "@/lib/enums";
import { CONDITION_LABEL, CUSTOMER_LABEL, OFFER_TYPE_LABEL, RULE_STATUS_LABEL } from "@/lib/labels";
import { Checkbox, enumOptions, Field, Fieldset, Select, TextArea, TextInput } from "./fields";

export interface CompanyOption {
  id: string;
  name: string;
  allowedDomains: string[];
  products: { id: string; name: string; plans: { id: string; name: string }[] }[];
}

export type OfferFormValues = Record<string, string | boolean | string[] | undefined>;

const INTERVAL_LABELS = { day: "Daily", week: "Weekly", month: "Monthly", year: "Annual", one_time: "One-time" };
const TRI_LABELS = { yes: "Yes", no: "No", unknown: "Not disclosed / unknown" };

export default function OfferForm({
  companies,
  categories,
  values = {},
  offerId,
}: {
  companies: CompanyOption[];
  categories: { id: string; name: string }[];
  values?: OfferFormValues;
  offerId?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveOfferAction, null);
  const submit = useKeepValuesSubmit(action);
  const [companyId, setCompanyId] = useState(String(values.companyId ?? ""));
  const [productId, setProductId] = useState(String(values.productId ?? ""));
  const [offerType, setOfferType] = useState(String(values.offerType ?? "direct"));
  const company = useMemo(() => companies.find((c) => c.id === companyId), [companies, companyId]);
  const product = company?.products.find((p) => p.id === productId);
  const errors = state?.fieldErrors;
  const v = (k: string) => (values[k] as string | undefined) ?? "";
  const b = (k: string) => values[k] === true;
  const list = (k: string) => (values[k] as string[] | undefined) ?? [];
  const duplicateError = errors?.allowDuplicate;

  return (
    <form action={action} onSubmit={submit} className="grid gap-6" noValidate>
      {offerId ? <input type="hidden" name="id" value={offerId} /> : null}

      <Fieldset legend="Offer basics" description="Company → product → plan are separate records; the plan anchors list-price comparisons.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Company" name="companyId" errors={errors}>
            <select
              id="companyId"
              name="companyId"
              required
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setProductId("");
              }}
              className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm"
            >
              <option value="">Choose a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product (optional)" name="productId" errors={errors}>
            <select id="productId" name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm">
              <option value="">—</option>
              {company?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plan (optional)" name="planId" errors={errors} hint="Needed for savings calculations.">
            <select id="planId" name="planId" defaultValue={v("planId")} key={productId} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm">
              <option value="">—</option>
              {product?.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Offer type" name="offerType" errors={errors}>
            <select id="offerType" name="offerType" value={offerType} onChange={(e) => setOfferType(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm">
              {OFFER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {OFFER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Availability" name="availability" errors={errors} hint="Unknown until confirmed.">
            <Select name="availability" defaultValue={v("availability") || "unknown"} options={enumOptions(AVAILABILITIES)} errors={errors} />
          </Field>
          <Field label="Risk tier" name="riskTier" errors={errors} hint="High: 7-day freshness, 6 h checks. Evergreen: 90 days, 72 h.">
            <Select name="riskTier" defaultValue={v("riskTier") || "standard"} options={enumOptions(RISK_TIERS)} errors={errors} />
          </Field>
        </div>
        <Field label="Title" name="title" errors={errors}>
          <TextInput name="title" defaultValue={v("title")} errors={errors} required placeholder="e.g. Professional plan free for verified students" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Primary benefit (shown largest)" name="benefit" errors={errors}>
            <TextInput name="benefit" defaultValue={v("benefit")} errors={errors} required placeholder="e.g. Free for 12 months" />
          </Field>
          <Field label="URL slug (optional)" name="slug" errors={errors} hint="Generated from company + title when empty.">
            <TextInput name="slug" defaultValue={v("slug")} errors={errors} />
          </Field>
        </div>
        <Field label="Summary (original wording, not copied)" name="summary" errors={errors}>
          <TextArea name="summary" defaultValue={v("summary")} errors={errors} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-medium">Categories</legend>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {categories.map((c) => (
                <Checkbox key={c.id} name="categoryIds" value={c.id} label={c.name} defaultChecked={list("categoryIds").includes(c.id)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Platforms</legend>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {PLATFORMS.map((p) => (
                <Checkbox key={p} name="platforms" value={p} label={p} defaultChecked={list("platforms").includes(p)} />
              ))}
            </div>
          </fieldset>
        </div>
      </Fieldset>

      <Fieldset legend="Pricing and renewal" description="Leave anything you have not seen in the official terms empty — it will display as “Not disclosed”. Never estimate.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Currency (ISO)" name="currency" errors={errors}>
            <TextInput name="currency" defaultValue={v("currency")} errors={errors} placeholder="USD" />
          </Field>
          <Field label="Promotional price" name="promoPrice" errorKey="promoPriceMinor" errors={errors}>
            <TextInput name="promoPrice" errorKey="promoPriceMinor" defaultValue={v("promoPrice")} errors={errors} inputMode="decimal" placeholder="0 for free" />
          </Field>
          <Field label="Billed" name="promoInterval" errors={errors}>
            <Select name="promoInterval" defaultValue={v("promoInterval")} options={enumOptions(BILLING_INTERVALS, INTERVAL_LABELS, "—")} errors={errors} />
          </Field>
          <Field label="Promotion lasts (months)" name="promoDurationMonths" errors={errors}>
            <TextInput name="promoDurationMonths" defaultValue={v("promoDurationMonths")} errors={errors} type="number" min={1} />
          </Field>
          <Field label="Paid upfront" name="upfrontPayment" errorKey="upfrontPaymentMinor" errors={errors}>
            <TextInput name="upfrontPayment" errorKey="upfrontPaymentMinor" defaultValue={v("upfrontPayment")} errors={errors} inputMode="decimal" />
          </Field>
          <Field label="Renewal price" name="renewalPrice" errorKey="renewalPriceMinor" errors={errors}>
            <TextInput name="renewalPrice" errorKey="renewalPriceMinor" defaultValue={v("renewalPrice")} errors={errors} inputMode="decimal" />
          </Field>
          <Field label="Renewal billed" name="renewalInterval" errors={errors}>
            <Select name="renewalInterval" defaultValue={v("renewalInterval")} options={enumOptions(BILLING_INTERVALS, INTERVAL_LABELS, "—")} errors={errors} />
          </Field>
          <Field label="Renews automatically" name="autoRenews" errors={errors}>
            <Select name="autoRenews" defaultValue={v("autoRenews") || "unknown"} options={enumOptions(TRI_STATES, TRI_LABELS)} errors={errors} />
          </Field>
          <Field label="Advertised discount %" name="advertisedDiscountPercent" errors={errors} hint="As the merchant states it.">
            <TextInput name="advertisedDiscountPercent" defaultValue={v("advertisedDiscountPercent")} errors={errors} type="number" min={1} max={100} />
          </Field>
          <Field label="Trial length (days)" name="trialDays" errors={errors}>
            <TextInput name="trialDays" defaultValue={v("trialDays")} errors={errors} type="number" min={1} />
          </Field>
          <Field label="Credit amount" name="creditAmount" errorKey="creditAmountMinor" errors={errors}>
            <TextInput name="creditAmount" errorKey="creditAmountMinor" defaultValue={v("creditAmount")} errors={errors} inputMode="decimal" />
          </Field>
          <Field label="Applies to existing accounts" name="appliesToExistingAccounts" errors={errors}>
            <Select name="appliesToExistingAccounts" defaultValue={v("appliesToExistingAccounts") || "unknown"} options={enumOptions(TRI_STATES, TRI_LABELS)} errors={errors} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Credit validity" name="creditValidity" errors={errors}>
            <TextInput name="creditValidity" defaultValue={v("creditValidity")} errors={errors} placeholder="e.g. Expires 90 days after activation" />
          </Field>
          <Field label="Cancellation terms" name="cancellationTerms" errors={errors}>
            <TextInput name="cancellationTerms" defaultValue={v("cancellationTerms")} errors={errors} />
          </Field>
          <Field label="Taxes" name="taxNote" errors={errors}>
            <TextInput name="taxNote" defaultValue={v("taxNote")} errors={errors} placeholder="e.g. Prices exclude VAT" />
          </Field>
          <Field label="Payment method requirement" name="paymentMethodNote" errors={errors}>
            <TextInput name="paymentMethodNote" defaultValue={v("paymentMethodNote")} errors={errors} />
          </Field>
        </div>
        {offerType === "lifetime" ? (
          <Field label="Lifetime terms" name="lifetimeTerms" errors={errors}>
            <TextArea name="lifetimeTerms" defaultValue={v("lifetimeTerms")} errors={errors} rows={2} />
          </Field>
        ) : null}
      </Fieldset>

      <Fieldset legend="Eligibility" description="Country rules: ISO codes (US, BD), regions (EU, EEA) or GLOBAL. Only list what official terms or evidence support. A reachable page is not evidence.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={RULE_STATUS_LABEL.confirmed_eligible} name="eligibleCountries" errors={errors}>
            <TextInput name="eligibleCountries" defaultValue={v("eligibleCountries")} errors={errors} placeholder="GLOBAL or US, CA, EU" />
          </Field>
          <Field label={RULE_STATUS_LABEL.confirmed_ineligible} name="ineligibleCountries" errors={errors}>
            <TextInput name="ineligibleCountries" defaultValue={v("ineligibleCountries")} errors={errors} />
          </Field>
          <Field label={RULE_STATUS_LABEL.likely_eligible} name="likelyCountries" errors={errors} hint="Tentative; never shown as confirmed.">
            <TextInput name="likelyCountries" defaultValue={v("likelyCountries")} errors={errors} />
          </Field>
          <Field label="Explicitly unknown" name="unknownCountries" errors={errors}>
            <TextInput name="unknownCountries" defaultValue={v("unknownCountries")} errors={errors} />
          </Field>
          <Field label="Everywhere else" name="defaultCountryStatus" errors={errors}>
            <Select name="defaultCountryStatus" defaultValue={v("defaultCountryStatus") || "unknown"} options={COUNTRY_STATUSES.map((s) => ({ value: s, label: RULE_STATUS_LABEL[s] }))} errors={errors} />
          </Field>
          <Field label="Customers" name="customerEligibility" errors={errors}>
            <Select name="customerEligibility" defaultValue={v("customerEligibility") || "unknown"} options={CUSTOMER_ELIGIBILITIES.map((c) => ({ value: c, label: CUSTOMER_LABEL[c] }))} errors={errors} />
          </Field>
          <Field label="Eligibility note" name="eligibilityNote" errors={errors}>
            <TextInput name="eligibilityNote" defaultValue={v("eligibilityNote")} errors={errors} />
          </Field>
          <Field label="Eligibility source URL" name="eligibilitySourceUrl" errors={errors}>
            <TextInput name="eligibilitySourceUrl" defaultValue={v("eligibilitySourceUrl")} errors={errors} type="url" />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Other conditions</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {CONDITION_KINDS.map((kind) => (
              <div key={kind} className="grid gap-1 rounded-lg border border-line p-2">
                <Checkbox name={`condition_${kind}`} label={CONDITION_LABEL[kind]} defaultChecked={b(`condition_${kind}`)} />
                <input
                  name={`conditionNote_${kind}`}
                  defaultValue={v(`conditionNote_${kind}`)}
                  aria-label={`${CONDITION_LABEL[kind]} details`}
                  placeholder="Details (optional)"
                  className="h-8 rounded-md border border-line bg-surface-2 px-2 text-xs"
                />
              </div>
            ))}
          </div>
        </fieldset>
      </Fieldset>

      <Fieldset legend="Student requirements" description="Required for student offers. We never collect credentials; describe the official verification path.">
        <Checkbox name="studentRequired" label="Student status required" defaultChecked={b("studentRequired") || offerType === "student"} />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Action label" name="studentAction" errors={errors}>
            <Select
              name="studentAction"
              defaultValue={v("studentAction")}
              options={enumOptions(STUDENT_ACTIONS, { claim: "Claim student offer", verify: "Verify student eligibility", view: "View student discount" }, "Automatic")}
              errors={errors}
            />
          </Field>
          <Field label="Verification provider" name="studentVerificationProvider" errors={errors}>
            <TextInput name="studentVerificationProvider" defaultValue={v("studentVerificationProvider")} errors={errors} placeholder="e.g. SheerID, UNiDAYS, school email" />
          </Field>
          <Field label="Student email required" name="studentEmailRequired" errors={errors}>
            <Select name="studentEmailRequired" defaultValue={v("studentEmailRequired") || "unknown"} options={enumOptions(TRI_STATES, TRI_LABELS)} errors={errors} />
          </Field>
        </div>
        <Field label="Educational eligibility requirements" name="studentRequirements" errors={errors}>
          <TextArea name="studentRequirements" defaultValue={v("studentRequirements")} errors={errors} rows={2} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Eligible institutions" name="institutionTypes" errors={errors}>
            <TextInput name="institutionTypes" defaultValue={v("institutionTypes")} errors={errors} />
          </Field>
          <Field label="Maximum eligible duration" name="maxEligibleDuration" errors={errors}>
            <TextInput name="maxEligibleDuration" defaultValue={v("maxEligibleDuration")} errors={errors} />
          </Field>
          <Field label="Re-verification" name="verificationRenewal" errors={errors}>
            <TextInput name="verificationRenewal" defaultValue={v("verificationRenewal")} errors={errors} />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Redemption, dates and disclosure">
        <Field label="Redemption URL" name="redemptionUrl" errors={errors} hint={company ? `Must be https on: ${company.allowedDomains.join(", ")}` : "Choose a company first."}>
          <TextInput name="redemptionUrl" defaultValue={v("redemptionUrl")} errors={errors} type="url" required hint />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Starts" name="startsAt" errors={errors}>
            <TextInput name="startsAt" defaultValue={v("startsAt")} errors={errors} type="date" />
          </Field>
          <Field label="Ends" name="endsAt" errors={errors}>
            <TextInput name="endsAt" defaultValue={v("endsAt")} errors={errors} type="date" />
          </Field>
          <div className="grid content-end pb-2">
            <Checkbox name="endsAtConfirmed" label="End date confirmed by an official source" defaultChecked={b("endsAtConfirmed")} hint="Only confirmed dates expire offers automatically." />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Official terms URL" name="officialTermsUrl" errors={errors}>
            <TextInput name="officialTermsUrl" defaultValue={v("officialTermsUrl")} errors={errors} type="url" />
          </Field>
          <Field label="Monitoring interval (hours, optional)" name="monitorIntervalHours" errors={errors} hint="Overrides the risk-tier default.">
            <TextInput name="monitorIntervalHours" defaultValue={v("monitorIntervalHours")} errors={errors} type="number" min={1} />
          </Field>
        </div>
        <Field label="Terms summary (our words)" name="termsSummary" errors={errors}>
          <TextArea name="termsSummary" defaultValue={v("termsSummary")} errors={errors} />
        </Field>
        <Field label="Known limitations" name="knownLimitations" errors={errors}>
          <TextArea name="knownLimitations" defaultValue={v("knownLimitations")} errors={errors} rows={2} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Checkbox name="isAffiliate" label="Affiliate link" defaultChecked={b("isAffiliate")} hint="Disclosed on the card and offer page." />
            <TextInput name="affiliateDisclosure" defaultValue={v("affiliateDisclosure")} errors={errors} placeholder="Disclosure text" />
          </div>
          <Checkbox name="isSponsored" label="Sponsored placement" defaultChecked={b("isSponsored")} hint="Labelled; never changes verification or organic ranking." />
        </div>
      </Fieldset>

      {duplicateError ? (
        <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] p-4 text-sm">
          <p className="text-warning">{duplicateError[0]}</p>
          <div className="mt-2">
            <Checkbox name="allowDuplicate" label="This offer is genuinely distinct (different eligibility, terms or redemption path)" />
          </div>
        </div>
      ) : null}
      {state?.duplicates?.length ? (
        <p className="rounded-xl bg-[var(--warning-bg)] p-3 text-sm text-warning">
          Possible duplicate of: {state.duplicates.map((d) => d.title).join(", ")}. Consider attaching sources to the existing offer instead.
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-fg px-5 text-sm font-medium text-[var(--ink-on-light)] hover:bg-white disabled:opacity-60">
          {pending ? "Saving…" : offerId ? "Save changes" : "Create draft"}
        </button>
        {state ? (
          <span role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-positive" : "text-negative"}`}>
            {state.ok ? state.message : state.error}
          </span>
        ) : null}
        {errors && Object.keys(errors).length ? <span className="text-xs text-negative">{Object.keys(errors).length} field(s) need attention.</span> : null}
      </div>
    </form>
  );
}
