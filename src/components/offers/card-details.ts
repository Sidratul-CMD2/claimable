import type { OfferCardView } from "@/server/services/offer-view";

/**
 * Extra content for individual offer cards, rendered only where a page asks for it (today: the
 * large featured slot of the homepage "Recently verified" section, which otherwise leaves the
 * card mostly empty). Static lines restate the offer's recorded terms and evidence (see
 * /deals/<slug>) and must be updated with them; price and renewal come from the live offer.
 */
export type CardDetailIcon = "payment" | "updates" | "devices" | "renewal";

export interface CardDetails {
  whatItDoes: string;
  included: { icon: CardDetailIcon; text: string }[];
  facts: { label: string; value: string }[];
}

const STATIC_DETAILS: Record<string, CardDetails> = {
  // Source: https://daisydiskapp.com/support/pricing (observed 2026-10-24) and the company record.
  "daisydisk-lifetime-licence": {
    whatItDoes: "Disk space analyser for Mac.",
    included: [
      { icon: "payment", text: "One-time payment, no subscription" },
      { icon: "updates", text: "Minor updates and bug fixes included" },
      { icon: "devices", text: "Covers up to 5 personal Macs" },
    ],
    facts: [
      { label: "Platform", value: "macOS only" },
      { label: "Licence type", value: "Lifetime (personal use)" },
    ],
  },
};

export function cardDetailsFor(offer: OfferCardView): CardDetails | undefined {
  const details = STATIC_DETAILS[offer.slug];
  if (!details) return undefined;
  return {
    ...details,
    included: offer.renewalLine ? [...details.included, { icon: "renewal", text: offer.renewalLine }] : details.included,
    facts: offer.priceLine ? [...details.facts, { label: "Price", value: offer.priceLine }] : details.facts,
  };
}
