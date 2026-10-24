import type { Metadata } from "next";
import DealsExplorer from "@/components/discovery/DealsExplorer";

export const metadata: Metadata = {
  title: "Software coupon codes",
  description: "Software promo codes with their source, status and restrictions. Reveal codes without signing up.",
  alternates: { canonical: "/coupons" },
};

export default async function CouponsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <DealsExplorer
      path="/coupons"
      searchParams={await searchParams}
      fixed={{ types: ["coupon"] }}
      heading="Coupon codes"
      intro="Codes are revealed without an account. Each code says where it was published and whether anyone has tested it — a published code can still fail for your account or country."
      navActive="type:coupon"
    />
  );
}
