import type { Metadata } from "next";
import DealsExplorer from "@/components/discovery/DealsExplorer";

export const metadata: Metadata = {
  title: "Free trials and promotional credits",
  description: "Software free trials and promotional credits, with what you pay when the trial ends.",
  alternates: { canonical: "/free-trials" },
};

export default async function FreeTrialsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <DealsExplorer
      path="/free-trials"
      searchParams={await searchParams}
      fixed={{ types: ["free_trial", "promo_credit"] }}
      heading="Free trials & promotional credits"
      intro="Check the price after the trial and whether a card is required before you start."
      navActive="type:free_trial"
    />
  );
}
