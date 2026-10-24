import type { Metadata } from "next";
import DealsExplorer from "@/components/discovery/DealsExplorer";

export const metadata: Metadata = {
  title: "Lifetime software deals",
  description: "One-time purchases under specific vendor terms — read what “lifetime” covers.",
  alternates: { canonical: "/lifetime-deals" },
};

export default async function LifetimeDealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <DealsExplorer
      path="/lifetime-deals"
      searchParams={await searchParams}
      fixed={{ types: ["lifetime"] }}
      heading="Lifetime deals"
      intro="“Lifetime” means what the vendor's terms say — often one major version or the life of the product. Each offer lists the exact terms we found."
      navActive="type:lifetime"
    />
  );
}
