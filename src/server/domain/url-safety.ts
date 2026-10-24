/**
 * URL validation for outbound redirects and connector retrieval.
 */
import { isIP } from "node:net";

const TRACKING_PARAMS = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|ref|referrer|source|_ga|igshid)$/i;

export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** Public offer and source URLs must be https without embedded credentials. */
export function isSafePublicUrl(raw: string): boolean {
  const url = parseHttpUrl(raw);
  return !!url && url.protocol === "https:" && !isPrivateHost(url.hostname);
}

/** Exact host or a subdomain of an approved host. "example.com" approves "www.example.com". */
export function hostMatches(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const domain = allowed.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}

export type RedirectDecision = { ok: true; url: string } | { ok: false; reason: "invalid_url" | "not_https" | "domain_not_approved" };

/** Outbound redirects only go to https URLs on the company's approved domains. */
export function resolveRedirect(raw: string, allowedDomains: string[]): RedirectDecision {
  const url = parseHttpUrl(raw);
  if (!url) return { ok: false, reason: "invalid_url" };
  if (url.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (!allowedDomains.some((d) => hostMatches(url.hostname, d))) return { ok: false, reason: "domain_not_approved" };
  return { ok: true, url: url.toString() };
}

/** Rejects loopback, private, link-local and metadata addresses (SSRF protection for connectors). */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const version = isIP(host);
  if (version === 4) {
    const [a, b] = host.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (version === 6) {
    return host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.startsWith("::ffff:");
  }
  return false;
}

/** Canonical form for dedupe: lowercase host without www, no tracking params, no fragment, no trailing slash. */
export function normalizeUrlForComparison(raw: string): string {
  const url = parseHttpUrl(raw);
  if (!url) return raw.trim().toLowerCase();
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${host}${path}${query}`;
}
