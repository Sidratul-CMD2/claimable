import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { companies, offers } from "@/server/db/schema";
import { resolveRedirect } from "@/server/domain/url-safety";
import { publicOfferWhere } from "@/server/services/bundles";
import { recordEvent } from "@/server/services/analytics";
import { normalizeCountry } from "@/lib/countries";
import { COUNTRY_COOKIE } from "@/lib/site";

/**
 * Outbound redirect to the merchant. Only https URLs on the company's approved domains are
 * followed. The click is recorded as an outbound interaction — not a purchase.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db
    .select({ id: offers.id, redemptionUrl: offers.redemptionUrl, availability: offers.availability, allowedDomains: companies.allowedDomains })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .where(and(eq(offers.slug, slug), publicOfferWhere({ includeExpired: true })))
    .limit(1);

  if (!row) return NextResponse.redirect(new URL("/deals?missing=1", request.url), 303);
  const decision = resolveRedirect(row.redemptionUrl, row.allowedDomains);
  if (!decision.ok) {
    console.error(`[go] Refused redirect for ${slug}: ${decision.reason}`);
    return NextResponse.redirect(new URL(`/deals/${slug}?redirect=blocked`, request.url), 303);
  }
  await recordEvent({ type: "claim", offerId: row.id, countryCode: normalizeCountry(request.cookies.get(COUNTRY_COOKIE)?.value), path: `/go/${slug}` });
  const response = NextResponse.redirect(decision.url, 302);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
