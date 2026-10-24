import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { offers } from "@/server/db/schema";
import { anonymousFingerprint, clientIp, consumeRateLimit } from "@/server/security/rate-limit";
import { recordEvent } from "@/server/services/analytics";
import { publicOfferWhere } from "@/server/services/bundles";

const bodySchema = z.object({ type: z.enum(["copy"]), slug: z.string().max(140) });

/** Client-side interaction events that the server cannot observe directly (code copied). */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const fingerprint = anonymousFingerprint(clientIp(request.headers), request.headers.get("user-agent"));
  const limit = await consumeRateLimit(`analytics:${fingerprint}`, 120, 600);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });
  const [offer] = await db.select({ id: offers.id }).from(offers).where(and(eq(offers.slug, parsed.data.slug), publicOfferWhere({ includeExpired: true }))).limit(1);
  if (offer) await recordEvent({ type: parsed.data.type, offerId: offer.id });
  return NextResponse.json({ ok: true });
}
