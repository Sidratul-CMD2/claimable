import { NextResponse, type NextRequest } from "next/server";
import { normalizeCountry } from "@/lib/countries";
import { COUNTRY_COOKIE } from "@/lib/site";
import { anonymousFingerprint, clientIp, consumeRateLimit } from "@/server/security/rate-limit";
import { recordEvent } from "@/server/services/analytics";
import { getRevealableCoupons } from "@/server/services/offer-detail";

/** Public coupon reveal: no account needed. Rate-limited per anonymous fingerprint. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fingerprint = anonymousFingerprint(clientIp(request.headers), request.headers.get("user-agent"));
  const limit = await consumeRateLimit(`reveal:${fingerprint}`, 60, 600);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const result = await getRevealableCoupons(slug);
  if (!result) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  await recordEvent({ type: "reveal", offerId: result.offerId, countryCode: normalizeCountry(request.cookies.get(COUNTRY_COOKIE)?.value) });
  return NextResponse.json({ coupons: result.coupons }, { headers: { "Cache-Control": "no-store" } });
}
