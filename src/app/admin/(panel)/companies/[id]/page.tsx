import { asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPlanAction, createProductAction, recordListPriceAction, saveCompanyAction } from "@/app/admin/actions";
import ActionForm from "@/components/admin/ActionForm";
import CompanyFields from "@/components/admin/CompanyFields";
import { Checkbox, enumOptions, Field, Select, TextInput } from "@/components/admin/fields";
import { BILLING_INTERVALS, PLATFORMS } from "@/lib/enums";
import { formatDate, formatPrice } from "@/lib/format";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { categories, companies, companyCategories, offers, plans, pricePoints, products } from "@/server/db/schema";

export const metadata = { title: "Company" };

export default async function AdminCompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePageUser();
  const { id } = await params;
  const { created } = await searchParams;
  const [company] = await db.select().from(companies).where(eq(companies.id, id));
  if (!company) notFound();
  const [cats, catLinks, productRows, offerRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(companyCategories).where(eq(companyCategories.companyId, id)),
    db.select().from(products).where(eq(products.companyId, id)).orderBy(asc(products.name)),
    db.select({ id: offers.id, title: offers.title, status: offers.publicationStatus }).from(offers).where(eq(offers.companyId, id)).orderBy(desc(offers.updatedAt)),
  ]);
  const planRows = productRows.length ? await db.select().from(plans).where(inArray(plans.productId, productRows.map((p) => p.id))).orderBy(asc(plans.name)) : [];
  const priceRows = planRows.length
    ? await db.select().from(pricePoints).where(inArray(pricePoints.planId, planRows.map((p) => p.id))).orderBy(desc(pricePoints.observedAt))
    : [];

  return (
    <div className="grid gap-6">
      <header>
        <Link href="/admin/companies" className="text-sm text-link">
          ← Companies
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">{company.name}</h1>
        {created ? (
          <p className="mt-2 rounded-lg bg-[var(--positive-bg)] px-3 py-2 text-sm text-positive" role="status">
            Company created. Add its products and plans, then create offers.
          </p>
        ) : null}
        <div className="mt-2 flex gap-3 text-sm">
          <Link href={`/admin/offers/new?companyId=${company.id}`} className="text-link">
            New offer for {company.name}
          </Link>
          <Link href={`/companies/${company.slug}`} className="text-link">
            Public page
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="bento-card p-5" aria-labelledby="details">
          <h2 id="details" className="font-display text-lg font-semibold">
            Details
          </h2>
          <ActionForm action={saveCompanyAction} submitLabel="Save company" className="mt-4">
            <input type="hidden" name="id" value={company.id} />
            <CompanyFields categories={cats} values={{ ...company, categoryIds: catLinks.map((c) => c.categoryId) }} />
          </ActionForm>
        </section>

        <div className="grid content-start gap-6">
          <section className="bento-card p-5" aria-labelledby="products">
            <h2 id="products" className="font-display text-lg font-semibold">
              Products, plans and list prices
            </h2>
            {productRows.length === 0 ? <p className="mt-2 text-sm text-muted">No products yet.</p> : null}
            <ul className="mt-3 grid gap-4">
              {productRows.map((p) => (
                <li key={p.id} className="rounded-xl border border-line p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.platforms.join(", ") || "Platforms not set"}</p>
                  <ul className="mt-2 grid gap-2">
                    {planRows
                      .filter((pl) => pl.productId === p.id)
                      .map((pl) => (
                        <li key={pl.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                          <p className="font-medium">
                            {pl.name} <span className="text-xs font-normal text-muted">({pl.audience})</span>
                          </p>
                          <ul className="mt-1 grid gap-0.5 text-xs text-muted">
                            {priceRows
                              .filter((pr) => pr.planId === pl.id)
                              .map((pr) => (
                                <li key={pr.id}>
                                  {formatPrice(pr.amountMinor, pr.currency, pr.interval)} · observed {formatDate(pr.observedAt)}
                                  {pr.countryCode ? ` · ${pr.countryCode}` : ""} {pr.isReliable ? "· reliable reference" : "· not a reliable reference"}
                                </li>
                              ))}
                          </ul>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-link">Record a list price</summary>
                            <ActionForm action={recordListPriceAction} submitLabel="Record price" resetOnSuccess className="mt-2">
                              <input type="hidden" name="planId" value={pl.id} />
                              <div className="grid grid-cols-3 gap-2">
                                <TextInput name="amount" scope={`price-${pl.id}`} aria-label="Amount" placeholder="12.99" inputMode="decimal" />
                                <TextInput name="currency" scope={`price-${pl.id}`} aria-label="Currency (ISO)" placeholder="USD" />
                                <Select name="interval" scope={`price-${pl.id}`} aria-label="Billing interval" options={enumOptions(BILLING_INTERVALS)} defaultValue="month" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <TextInput name="observedAt" scope={`price-${pl.id}`} aria-label="Observed on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                                <TextInput name="countryCode" scope={`price-${pl.id}`} aria-label="Country (optional)" placeholder="Country (optional)" />
                              </div>
                              <TextInput name="sourceUrl" scope={`price-${pl.id}`} aria-label="Official pricing page URL" type="url" placeholder="Official pricing page URL" />
                              <Checkbox name="isReliable" scope={`price-${pl.id}`} label="Official price for exactly this plan (may anchor savings)" />
                            </ActionForm>
                          </details>
                        </li>
                      ))}
                  </ul>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-link">Add a plan</summary>
                    <ActionForm action={createPlanAction} submitLabel="Add plan" resetOnSuccess className="mt-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <div className="grid grid-cols-2 gap-2">
                        <TextInput name="name" scope={`plan-${p.id}`} aria-label="Plan name" placeholder="Plan name" required />
                        <Select name="audience" scope={`plan-${p.id}`} aria-label="Audience" options={enumOptions(["individual", "team", "business", "education", "family"] as const)} />
                      </div>
                      <TextInput name="officialPricingUrl" scope={`plan-${p.id}`} aria-label="Official pricing URL" type="url" placeholder="Official pricing URL" />
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-link">Add a product</summary>
              <ActionForm action={createProductAction} submitLabel="Add product" resetOnSuccess className="mt-2">
                <input type="hidden" name="companyId" value={company.id} />
                <Field label="Product name" name="name" scope="new-product">
                  <TextInput name="name" scope="new-product" required />
                </Field>
                <div className="grid grid-cols-3 gap-1.5">
                  {PLATFORMS.map((pl) => (
                    <Checkbox key={pl} name="platforms" scope="new-product" value={pl} label={pl} />
                  ))}
                </div>
              </ActionForm>
            </details>
          </section>

          <section className="bento-card p-5" aria-labelledby="company-offers">
            <h2 id="company-offers" className="font-display text-lg font-semibold">
              Offers
            </h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {offerRows.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <Link href={`/admin/offers/${o.id}`} className="truncate text-link">
                    {o.title}
                  </Link>
                  <span className="text-muted">{o.status.replace("_", " ")}</span>
                </li>
              ))}
              {offerRows.length === 0 ? <li className="text-muted">None yet.</li> : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
