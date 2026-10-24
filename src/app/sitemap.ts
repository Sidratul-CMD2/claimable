import { and, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { db } from "@/server/db";
import { categories, offers } from "@/server/db/schema";
import { publicOfferWhere } from "@/server/services/bundles";
import { listCompanies } from "@/server/services/companies";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [offerRows, categoryRows, companyRows] = await Promise.all([
    db.select({ slug: offers.slug, updatedAt: offers.updatedAt }).from(offers).where(and(publicOfferWhere({ includeExpired: true }), eq(offers.isFixture, false))),
    db.select({ slug: categories.slug }).from(categories).where(eq(categories.isVisible, true)),
    listCompanies(),
  ]);
  const fixed = ["", "/deals", "/students", "/coupons", "/free-trials", "/lifetime-deals", "/calendar", "/companies", "/methodology", "/submit"];
  return [
    ...fixed.map((p) => ({ url: `${site.url}${p}`, changeFrequency: "daily" as const })),
    ...categoryRows.map((c) => ({ url: `${site.url}/categories/${c.slug}`, changeFrequency: "daily" as const })),
    ...companyRows.map((c) => ({ url: `${site.url}/companies/${c.slug}`, changeFrequency: "weekly" as const })),
    ...offerRows.map((o) => ({ url: `${site.url}/deals/${o.slug}`, lastModified: o.updatedAt, changeFrequency: "daily" as const })),
  ];
}
