/**
 * Polite, defensive HTTP retrieval for connectors.
 *
 * - Honours robots.txt for our user agent (cached 12 h); never bypasses login, CAPTCHA or
 *   anti-bot responses (401/403/429 are reported as "blocked").
 * - At least CONNECTOR_HOST_INTERVAL_MS (default 10 s) between requests to the same host.
 * - SSRF protection: only http(s), no credentials, every redirect hop and every resolved IP
 *   must be public. (Tests may allow loopback with CONNECTOR_ALLOW_PRIVATE_HOSTS=1 outside production.)
 * - 15 s timeout, 2 MB body limit, text-like content types only. Retrieved content is treated
 *   as untrusted data: it is converted to plain text and never executed or rendered as HTML.
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import robotsParser from "robots-parser";
import { site } from "@/lib/site";
import type { FetchResult } from "../domain/monitoring";
import { isPrivateHost, parseHttpUrl } from "../domain/url-safety";

const hostIntervalMs = () => Number(process.env.CONNECTOR_HOST_INTERVAL_MS ?? 10_000);
const timeoutMs = () => Number(process.env.CONNECTOR_TIMEOUT_MS ?? 15_000);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const ROBOTS_TTL_MS = 12 * 3_600_000;
const ALLOWED_TYPES = /^(text\/(html|plain|xml)|application\/(xhtml\+xml|xml|rss\+xml|atom\+xml|json|feed\+json))/i;

const lastRequestByHost = new Map<string, number>();
const robotsCache = new Map<string, { fetchedAt: number; robots: ReturnType<typeof robotsParser> | "allow-all" | "unavailable" }>();

const allowPrivate = () => process.env.CONNECTOR_ALLOW_PRIVATE_HOSTS === "1" && process.env.NODE_ENV !== "production";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RetrievalError extends Error {
  constructor(
    message: string,
    public readonly kind: "invalid_url" | "network_error" | "timeout",
  ) {
    super(message);
  }
}

async function assertPublicTarget(url: URL) {
  if (allowPrivate()) return;
  if (isPrivateHost(url.hostname)) throw new RetrievalError(`Refusing private host ${url.hostname}`, "invalid_url");
  try {
    const addresses = await lookup(url.hostname, { all: true });
    if (addresses.some((a) => isPrivateHost(a.address))) throw new RetrievalError(`${url.hostname} resolves to a private address`, "invalid_url");
  } catch (error) {
    if (error instanceof RetrievalError) throw error;
    throw new RetrievalError(`DNS lookup failed for ${url.hostname}`, "network_error");
  }
}

async function waitForHost(host: string) {
  const last = lastRequestByHost.get(host) ?? 0;
  const wait = last + hostIntervalMs() - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestByHost.set(host, Date.now());
}

/**
 * GET with manual, validated redirects. The timeout covers each request's network time only:
 * the per-host politeness wait happens before the timer starts, so same-host redirects
 * (robots.txt → page → redirected page) don't time out while we are deliberately waiting.
 * Call `release()` after reading the body.
 */
async function rawGet(
  url: URL,
  accept: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ response: Response; finalUrl: URL; release: () => void }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicTarget(current);
    await waitForHost(current.host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs());
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        // Credentials (partner feeds) never follow a redirect to another host.
        headers: { "User-Agent": site.botUserAgent, Accept: accept, "Accept-Language": "en", ...(current.host === url.host ? extraHeaders : {}) },
      });
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      const next = parseHttpUrl(new URL(response.headers.get("location")!, current).toString());
      await response.body?.cancel();
      clearTimeout(timer);
      if (!next) throw new RetrievalError("Redirect to an unsupported URL", "invalid_url");
      current = next;
      continue;
    }
    return { response, finalUrl: current, release: () => clearTimeout(timer) };
  }
  throw new RetrievalError("Too many redirects", "network_error");
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/** robots.txt decision for a URL. 4xx robots = allow all; network/5xx = unavailable (skip for now). */
export async function robotsAllows(url: URL): Promise<"allowed" | "disallowed" | "unavailable"> {
  const origin = url.origin;
  let entry = robotsCache.get(origin);
  if (!entry || Date.now() - entry.fetchedAt > ROBOTS_TTL_MS) {
    const robotsUrl = new URL("/robots.txt", origin);
    try {
      const { response, release } = await rawGet(robotsUrl, "text/plain");
      try {
        if (response.status >= 400 && response.status < 500) {
          await response.body?.cancel();
          entry = { fetchedAt: Date.now(), robots: "allow-all" };
        } else if (response.ok) {
          entry = { fetchedAt: Date.now(), robots: robotsParser(robotsUrl.toString(), await readLimited(response)) };
        } else {
          await response.body?.cancel();
          entry = { fetchedAt: Date.now(), robots: "unavailable" };
        }
      } finally {
        release();
      }
    } catch {
      entry = { fetchedAt: Date.now(), robots: "unavailable" };
    }
    robotsCache.set(origin, entry);
  }
  if (entry.robots === "allow-all") return "allowed";
  if (entry.robots === "unavailable") return "unavailable";
  const ua = site.botUserAgent.split("/")[0];
  return entry.robots.isAllowed(url.toString(), ua) === false ? "disallowed" : "allowed";
}

/** Named entities commonly used for prices and punctuation on offer pages. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", percnt: "%", dollar: "$", euro: "€", pound: "£", yen: "¥",
  cent: "¢", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  times: "×", middot: "·", bull: "•", copy: "©", reg: "®", trade: "™", deg: "°", plus: "+", num: "#", colon: ":",
  comma: ",", period: ".", sol: "/", excl: "!", quest: "?", lpar: "(", rpar: ")", minus: "−", half: "½",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export interface PoliteFetchResult {
  result: FetchResult;
  /** Raw body (for feeds); undefined when not retrieved. */
  body?: string;
  contentType?: string;
  durationMs: number;
}

export async function politeFetch(rawUrl: string, opts: { accept?: string; headers?: Record<string, string> } = {}): Promise<PoliteFetchResult> {
  const started = Date.now();
  const done = (result: FetchResult, extra: Partial<PoliteFetchResult> = {}): PoliteFetchResult => ({ result, durationMs: Date.now() - started, ...extra });
  const url = parseHttpUrl(rawUrl);
  if (!url) return done({ kind: "invalid_url", error: "Not an http(s) URL" });

  try {
    const robots = await robotsAllows(url);
    if (robots === "disallowed") return done({ kind: "robots_disallowed" });
    if (robots === "unavailable") return done({ kind: "network_error", error: "robots.txt could not be retrieved; skipped politely" });

    const { response, finalUrl, release } = await rawGet(url, opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", opts.headers);
    try {
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        await response.body?.cancel();
        return done({ kind: "response", httpStatus: response.status, finalUrl: finalUrl.toString(), contentHash: null, text: null }, { contentType });
      }
      if (contentType && !ALLOWED_TYPES.test(contentType)) {
        await response.body?.cancel();
        return done({ kind: "network_error", error: `Unsupported content type ${contentType.split(";")[0]}` });
      }
      const body = await readLimited(response);
      const looksLikeHtml = /html/i.test(contentType) || (/^\s*</.test(body) && !/xml|json/i.test(contentType));
      const text = looksLikeHtml ? htmlToText(body) : body;
      const contentHash = createHash("sha256").update(text.replace(/\s+/g, " ")).digest("hex");
      return done({ kind: "response", httpStatus: response.status, finalUrl: finalUrl.toString(), contentHash, text }, { body, contentType });
    } finally {
      release();
    }
  } catch (error) {
    if (error instanceof RetrievalError) return done(error.kind === "invalid_url" ? { kind: "invalid_url", error: error.message } : { kind: error.kind, error: error.message } as FetchResult);
    if ((error as Error)?.name === "AbortError") return done({ kind: "timeout", error: `No response within ${timeoutMs() / 1000}s` });
    return done({ kind: "network_error", error: (error as Error)?.message ?? "Network error" });
  }
}

/** Test helper: forget cached robots.txt and host timings. */
export function resetHttpState() {
  robotsCache.clear();
  lastRequestByHost.clear();
}
