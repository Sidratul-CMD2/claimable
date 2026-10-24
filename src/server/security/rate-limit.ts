import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Fixed-window counter stored in Postgres so limits hold across processes. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.execute<{ count: number; window_start: Date }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count, window_start
  `);
  const row = rows[0];
  const count = Number(row.count);
  const windowStart = new Date(row.window_start);
  const retryAfterSeconds = Math.max(0, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

/**
 * Anonymous, non-reversible fingerprint for abuse prevention. Rotates daily, so it cannot
 * track visitors across days. Raw IPs and user agents are never stored.
 */
export function anonymousFingerprint(ip: string | null, userAgent: string | null, now: Date = new Date()): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production.");
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", secret ?? "development-only-secret")
    .update(`${day}|${ip ?? "?"}|${(userAgent ?? "").slice(0, 200)}`)
    .digest("base64url")
    .slice(0, 22);
}

/** First hop of X-Forwarded-For when behind a trusted proxy; otherwise X-Real-IP. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip");
}
