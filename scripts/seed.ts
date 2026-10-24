/**
 * Seeds reference data and the researched launch catalog (data/catalog). Idempotent: existing
 * companies, products, plans and offers (matched by slug) are left untouched.
 *   bun run db:seed
 *   bun run db:seed -- --update   # also apply catalog edits to offers this seed created
 * Offers go through the same admin services as manual entry (validation, dedupe, audit,
 * revisions). Each is published only if it passes the publish checks.
 */
import { and, eq } from "drizzle-orm";
import { COMPANIES, OBSERVED_ON, OFFERS } from "../data/catalog/offers";
import { closeDb, db } from "../src/server/db";
import { categories, companies, offerSources, offers, plans, pricePoints, products, sources } from "../src/server/db/schema";
import { attachSource, createOffer, detachSource, recordVerification, setPublicationStatus, slugify, updateOffer, ValidationFailure } from "../src/server/services/admin-offers";
import { createCompany, createPlan, createProduct, recordListPrice } from "../src/server/services/admin-catalog";
import type { Actor } from "../src/server/services/audit";
import { seedReferenceData } from "../src/server/services/reference-data";

const UPDATE = process.argv.includes("--update");
const actor: Actor = { id: null, email: "editorial-research", type: "system", label: `Editorial research (${OBSERVED_ON})` };
/** End of the research window on the observation day (pages were read between ~00:30 and 01:30 UTC). */
const observedAt = new Date(`${OBSERVED_ON}T01:30:00Z`);

/**
 * Applies catalog edits to an offer the seed created (never to offers edited by people):
 * offer fields via updateOffer (revision + audit), and sources attached/detached to match.
 */
async function updateFromCatalog(existing: typeof offers.$inferSelect, entry: (typeof OFFERS)[number]): Promise<boolean> {
  if (existing.createdBy !== null || existing.updatedBy !== null) return false;
  const categoryRows = await db.select().from(categories);
  const { categories: offerCategories, ...fields } = entry.offer;
  await updateOffer(actor, existing.id, {
    ...fields,
    slug: entry.slug,
    companyId: existing.companyId,
    productId: existing.productId,
    planId: existing.planId,
    categoryIds: categoryRows.filter((c) => offerCategories.includes(c.slug)).map((c) => c.id),
  });
  const current = await db
    .select({ id: sources.id, url: sources.url })
    .from(offerSources)
    .innerJoin(sources, eq(sources.id, offerSources.sourceId))
    .where(eq(offerSources.offerId, existing.id));
  const wanted = new Set(entry.sources.map((s) => s.url));
  for (const c of current) if (!wanted.has(c.url)) await detachSource(actor, existing.id, c.id);
  for (const s of entry.sources) {
    await attachSource(actor, { offerId: existing.id, url: s.url, sourceType: s.sourceType, title: s.title, publisher: entry.company, isOfficial: true, role: s.role, expectedMarkers: s.markers });
  }
  return true;
}

/** Sources → editorial verification → publish. Throws if publication is blocked. */
async function finishOffer(offerId: string, entry: (typeof OFFERS)[number]) {
  for (const s of entry.sources) {
    await attachSource(actor, { offerId, url: s.url, sourceType: s.sourceType, title: s.title, publisher: entry.company, isOfficial: true, role: s.role, expectedMarkers: s.markers });
  }
  await recordVerification(actor, {
    offerId,
    state: "officially_confirmed",
    method: "editorial_official_page_review",
    evidenceUrl: entry.sources[0].url,
    note: entry.evidence.note,
    verifiedAt: observedAt,
  });
  const publish = await setPublicationStatus(actor, offerId, "published", `Published from editorial research on ${OBSERVED_ON}`);
  if (!publish.ok) throw new Error(publish.problems.join("; "));
}

async function main() {
  await seedReferenceData(db);
  const categoryRows = await db.select().from(categories);
  const categoryIds = (slugs: string[]) => categoryRows.filter((c) => slugs.includes(c.slug)).map((c) => c.id);

  const companyIds = new Map<string, string>();
  for (const c of COMPANIES) {
    const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, c.slug));
    const id =
      existing?.id ??
      (await createCompany(actor, { name: c.name, slug: c.slug, websiteUrl: c.websiteUrl, description: c.description, allowedDomains: c.allowedDomains, categoryIds: categoryIds(c.categories) })).id;
    companyIds.set(c.slug, id);
  }

  let created = 0;
  let published = 0;
  let updated = 0;
  const problems: string[] = [];
  for (const entry of OFFERS) {
    const [existingOffer] = await db.select().from(offers).where(eq(offers.slug, entry.slug));
    if (existingOffer && UPDATE) {
      try {
        if (await updateFromCatalog(existingOffer, entry)) updated++;
      } catch (error) {
        problems.push(`${entry.slug}: ${error instanceof ValidationFailure ? JSON.stringify(error.fieldErrors) : (error as Error).message}`);
      }
      continue;
    }
    if (existingOffer) {
      // Resume an interrupted run: finish evidence and publication for offers this seed created.
      if (existingOffer.publicationStatus === "draft" && existingOffer.verificationState === "unverified") {
        try {
          await finishOffer(existingOffer.id, entry);
          published++;
        } catch (error) {
          problems.push(`${entry.slug}: ${error instanceof ValidationFailure ? JSON.stringify(error.fieldErrors) : (error as Error).message}`);
        }
      }
      continue;
    }
    const companyId = companyIds.get(entry.company)!;

    let productId: string | null = null;
    if (entry.product) {
      const productSlug = slugify(entry.product.name);
      const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.companyId, companyId), eq(products.slug, productSlug)));
      productId = p?.id ?? (await createProduct(actor, { companyId, name: entry.product.name, slug: productSlug, platforms: entry.product.platforms ?? [] })).id;
    }
    let planId: string | null = null;
    if (entry.plan && productId) {
      const planSlug = slugify(entry.plan.name);
      const [pl] = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.productId, productId), eq(plans.slug, planSlug)));
      planId =
        pl?.id ??
        (await createPlan(actor, { productId, name: entry.plan.name, slug: planSlug, audience: entry.plan.audience ?? "individual", officialPricingUrl: entry.plan.officialPricingUrl ?? "" })).id;
      const lp = entry.plan.listPrice;
      if (lp) {
        const [already] = await db.select({ id: pricePoints.id }).from(pricePoints).where(and(eq(pricePoints.planId, planId), eq(pricePoints.kind, "list")));
        if (!already) {
          await recordListPrice(actor, { planId, amountMinor: lp.amountMinor, currency: lp.currency, interval: lp.interval, countryCode: lp.countryCode ?? "", observedAt, sourceUrl: lp.sourceUrl, isReliable: true, note: lp.note ?? "" });
        }
      }
    }

    try {
      const { categories: offerCategories, ...fields } = entry.offer;
      const result = await createOffer(actor, { ...fields, slug: entry.slug, companyId, productId, planId, categoryIds: categoryIds(offerCategories) });
      created++;
      await finishOffer(result.id, entry);
      published++;
    } catch (error) {
      problems.push(`${entry.slug}: ${error instanceof ValidationFailure ? JSON.stringify(error.fieldErrors) : (error as Error).message}`);
    }
  }

  console.log(`[seed] Reference data ready. Catalog: ${created} offers created, ${published} published${UPDATE ? `, ${updated} updated` : ""} (${OFFERS.length} in catalog).`);
  if (problems.length) {
    console.warn(`[seed] ${problems.length} offer(s) not published:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(closeDb);
