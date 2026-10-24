import { sql } from "drizzle-orm";
import type { ReviewKind } from "@/lib/enums";
import type { DbOrTx } from "../db";
import { reviewItems } from "../db/schema";

/** Opens a review item unless an open one with the same dedupe key already exists. */
export async function openReviewItem(
  tx: DbOrTx,
  item: { kind: ReviewKind; priority: 1 | 2 | 3; title: string; details: string; dedupeKey: string; offerId?: string | null; sourceId?: string | null; payload?: unknown },
): Promise<boolean> {
  const inserted = await tx
    .insert(reviewItems)
    .values({
      kind: item.kind,
      priority: item.priority,
      title: item.title.slice(0, 300),
      details: item.details.slice(0, 2000),
      dedupeKey: item.dedupeKey,
      offerId: item.offerId ?? null,
      sourceId: item.sourceId ?? null,
      payload: item.payload ?? null,
    })
    .onConflictDoNothing({ target: reviewItems.dedupeKey, where: sql`status = 'open'` })
    .returning({ id: reviewItems.id });
  return inserted.length > 0;
}
