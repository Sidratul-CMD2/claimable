import type { Metadata } from "next";
import DealsExplorer from "@/components/discovery/DealsExplorer";

export const metadata: Metadata = {
  title: "Explore software deals",
  description: "Search software discounts, coupons, student offers, free trials and lifetime deals, filtered by your country and eligibility.",
  alternates: { canonical: "/deals" },
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <DealsExplorer
      path="/deals"
      searchParams={params}
      heading={params.q ? `Deals matching “${String(params.q).slice(0, 60)}”` : "Explore software deals"}
      intro="Every offer shows its country eligibility, renewal price and when we last confirmed it."
      navActive="all"
    />
  );
}
