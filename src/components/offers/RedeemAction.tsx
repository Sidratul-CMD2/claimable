"use client";

import { Check, Copy, ExternalLink, Loader2, TicketPercent } from "lucide-react";
import { useState } from "react";

interface RevealedCoupon {
  id: string;
  code: string;
  status: string;
  description: string;
  lastTestedAt: string | null;
  testCountry: string | null;
}

const STATUS_TEXT: Record<string, string> = {
  officially_published: "Published by the merchant",
  redemption_tested: "Redemption tested",
  unverified: "Not yet verified — may not work",
  expired: "Expired code",
};

/**
 * Primary redemption control. Claim actions are links through /go/<slug> (records an outbound
 * interaction, then redirects to the approved merchant). Coupons use Reveal Code → copy, with a
 * no-JavaScript fallback that server-renders the codes on the offer page.
 */
export default function RedeemAction({
  slug,
  kind,
  label,
  secondaryLabel,
  isAffiliate,
  unavailableReason,
  layout = "card",
  initialCoupons,
}: {
  slug: string;
  kind: "reveal" | "claim" | "none";
  label: string;
  secondaryLabel: string | null;
  isAffiliate: boolean;
  unavailableReason: string | null;
  layout?: "card" | "panel";
  initialCoupons?: RevealedCoupon[];
}) {
  const [coupons, setCoupons] = useState<RevealedCoupon[] | null>(initialCoupons ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  const rel = `nofollow noopener noreferrer${isAffiliate ? " sponsored" : ""}`;
  const full = layout === "panel" ? "h-12 text-[15px]" : "h-11 text-sm";

  if (kind === "none") {
    return (
      <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted" role="note">
        {unavailableReason ?? label}
      </p>
    );
  }

  const merchantLink = (text: string, primary: boolean) => (
    <a
      href={`/go/${slug}`}
      target="_blank"
      rel={rel}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 font-medium transition-colors ${full} ${
        primary ? "bg-fg text-[var(--ink-on-light)] hover:bg-white" : "border border-line-strong bg-transparent text-fg hover:bg-surface-3"
      }`}
    >
      {text}
      <ExternalLink className="size-4" aria-hidden="true" />
      <span className="sr-only">(opens the merchant site in a new tab)</span>
    </a>
  );

  if (kind === "claim") return merchantLink(label, true);

  const reveal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(slug)}/reveal`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { coupons: RevealedCoupon[] };
      setCoupons(data.coupons);
    } catch {
      setError("We couldn't load the code. Open the offer page to see it, or try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (coupon: RevealedCoupon) => {
    setCopyFailed(null);
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(coupon.id);
      setTimeout(() => setCopied((c) => (c === coupon.id ? null : c)), 2500);
      void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "copy", slug }), keepalive: true });
    } catch {
      setCopyFailed(coupon.id);
    }
  };

  if (!coupons) {
    return (
      <div className="grid gap-2">
        <button
          type="button"
          onClick={reveal}
          disabled={loading}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-fg px-4 font-medium text-[var(--ink-on-light)] hover:bg-white disabled:opacity-70 ${full}`}
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <TicketPercent className="size-4" aria-hidden="true" />}
          {loading ? "Revealing…" : label}
        </button>
        <noscript>
          <a href={`/deals/${slug}?reveal=1#codes`} className="text-link text-sm">
            Show the code (JavaScript is off)
          </a>
        </noscript>
        {error ? (
          <p className="text-sm text-warning" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2" aria-live="polite">
      {coupons.length === 0 ? <p className="text-sm text-muted">No usable code is currently recorded for this offer.</p> : null}
      {coupons.map((coupon) => (
        <div key={coupon.id} className="rounded-2xl border border-dashed border-line-strong bg-surface-2 p-2.5">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg px-2 py-1.5 font-mono text-base font-semibold tracking-wider text-fg" aria-label={`Coupon code ${coupon.code}`}>
              {coupon.code}
            </code>
            <button
              type="button"
              onClick={() => copy(coupon)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-surface-3"
              aria-label={copied === coupon.id ? `Copied ${coupon.code}` : `Copy code ${coupon.code}`}
            >
              {copied === coupon.id ? <Check className="size-4 text-positive" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied === coupon.id ? "Copied" : "Copy"}
            </button>
          </div>
          <p className={`mt-1.5 px-1 text-xs ${coupon.status === "unverified" || coupon.status === "expired" ? "text-caution" : "text-muted"}`}>
            {STATUS_TEXT[coupon.status] ?? coupon.status}
            {coupon.status === "redemption_tested" && coupon.lastTestedAt
              ? ` · ${new Date(coupon.lastTestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}${coupon.testCountry ? ` (${coupon.testCountry})` : ""}`
              : ""}
            {coupon.description ? ` · ${coupon.description}` : ""}
          </p>
          {copyFailed === coupon.id ? (
            <p className="mt-1 px-1 text-xs text-warning" role="alert">
              Copying isn&apos;t available here. Select the code above and copy it manually.
            </p>
          ) : null}
        </div>
      ))}
      <span className="sr-only" role="status">
        {copied ? "Code copied to clipboard" : ""}
      </span>
      {merchantLink(secondaryLabel ?? "Visit website", false)}
    </div>
  );
}
