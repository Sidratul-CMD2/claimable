import Link from "next/link";
import OfferForm from "@/components/admin/OfferForm";
import { requirePageUser } from "@/server/auth/guard";
import { offerFormOptions } from "@/server/services/admin-offer-read";

export const metadata = { title: "New offer" };

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  await requirePageUser();
  const { companyId } = await searchParams;
  const options = await offerFormOptions();
  return (
    <div className="grid gap-6">
      <header>
        <Link href="/admin/offers" className="text-sm text-link">
          ← Offers
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">New offer</h1>
        <p className="text-sm text-muted">
          Offers start as drafts. Attach an official source and record verification evidence before publishing. Missing company or plan?{" "}
          <Link href="/admin/companies" className="text-link">
            Add it first
          </Link>
          .
        </p>
      </header>
      {options.companies.length ? (
        <OfferForm companies={options.companies} categories={options.categories} values={{ companyId: companyId ?? "" }} />
      ) : (
        <p className="rounded-xl border border-line p-6 text-sm text-muted">
          Create a company (with its approved redirect domains) before adding offers.{" "}
          <Link href="/admin/companies" className="text-link">
            Add a company
          </Link>
        </p>
      )}
    </div>
  );
}
