/**
 * Companies, products, plans, list prices, categories and homepage configuration.
 */
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { categories, companies, companyCategories, homepageSections, offers, plans, pricePoints, products } from "../db/schema";
import {
  categoryInputSchema,
  companyInputSchema,
  listPriceInputSchema,
  planInputSchema,
  productInputSchema,
} from "../validation/admin";
import { parseOrThrow, refreshDerivedFields, slugify, ValidationFailure } from "./admin-offers";
import { writeAudit, type Actor } from "./audit";

export async function createCompany(actor: Actor, raw: unknown, opts: { isFixture?: boolean } = {}) {
  const input = parseOrThrow(companyInputSchema, raw);
  return db.transaction(async (tx) => {
    const slug = input.slug ?? slugify(input.name);
    const [clash] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1);
    if (clash) throw new ValidationFailure({ slug: ["A company with this slug already exists."] });
    const [row] = await tx
      .insert(companies)
      .values({
        name: input.name,
        slug,
        websiteUrl: input.websiteUrl,
        description: input.description,
        allowedDomains: input.allowedDomains,
        logoUrl: input.logoUrl,
        isFixture: opts.isFixture ?? false,
      })
      .returning();
    if (input.categoryIds.length) {
      await tx.insert(companyCategories).values(input.categoryIds.map((categoryId) => ({ companyId: row.id, categoryId })));
    }
    await writeAudit(tx, actor, "company.create", "company", row.id, undefined, input);
    return row;
  });
}

export async function updateCompany(actor: Actor, id: string, raw: unknown) {
  const input = parseOrThrow(companyInputSchema, raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!before) throw new ValidationFailure({ form: ["Company not found."] });
    const slug = input.slug ?? before.slug;
    const [clash] = await tx.select({ id: companies.id }).from(companies).where(and(eq(companies.slug, slug), ne(companies.id, id))).limit(1);
    if (clash) throw new ValidationFailure({ slug: ["A company with this slug already exists."] });
    const [after] = await tx
      .update(companies)
      .set({
        name: input.name,
        slug,
        websiteUrl: input.websiteUrl,
        description: input.description,
        allowedDomains: input.allowedDomains,
        logoUrl: input.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();
    await tx.delete(companyCategories).where(eq(companyCategories.companyId, id));
    if (input.categoryIds.length) {
      await tx.insert(companyCategories).values(input.categoryIds.map((categoryId) => ({ companyId: id, categoryId })));
    }
    if (before.name !== after.name) {
      const companyOffers = await tx.select({ id: offers.id }).from(offers).where(eq(offers.companyId, id));
      for (const o of companyOffers) await refreshDerivedFields(tx, o.id);
    }
    await writeAudit(tx, actor, "company.update", "company", id, before, after);
    return after;
  });
}

export async function createProduct(actor: Actor, raw: unknown) {
  const input = parseOrThrow(productInputSchema, raw);
  return db.transaction(async (tx) => {
    const slug = input.slug ?? slugify(input.name);
    const [clash] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.companyId, input.companyId), eq(products.slug, slug)))
      .limit(1);
    if (clash) throw new ValidationFailure({ slug: ["This company already has a product with that slug."] });
    const [row] = await tx.insert(products).values({ ...input, slug }).returning();
    await writeAudit(tx, actor, "product.create", "product", row.id, undefined, input);
    return row;
  });
}

export async function createPlan(actor: Actor, raw: unknown) {
  const input = parseOrThrow(planInputSchema, raw);
  return db.transaction(async (tx) => {
    const slug = input.slug ?? slugify(input.name);
    const [clash] = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.productId, input.productId), eq(plans.slug, slug)))
      .limit(1);
    if (clash) throw new ValidationFailure({ slug: ["This product already has a plan with that slug."] });
    const [row] = await tx.insert(plans).values({ ...input, slug }).returning();
    await writeAudit(tx, actor, "plan.create", "plan", row.id, undefined, input);
    return row;
  });
}

/** Append-only list-price observation for a plan. */
export async function recordListPrice(actor: Actor, raw: unknown) {
  const input = parseOrThrow(listPriceInputSchema, raw);
  if (input.isReliable && !input.sourceUrl) {
    throw new ValidationFailure({ sourceUrl: ["A reliable reference price needs the official pricing source URL."] });
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(pricePoints)
      .values({ ...input, kind: "list", recordedBy: actor.id })
      .returning();
    await writeAudit(tx, actor, "price.record", "plan", input.planId, undefined, input);
    return row;
  });
}

export async function createCategory(actor: Actor, raw: unknown) {
  const input = parseOrThrow(categoryInputSchema, raw);
  return db.transaction(async (tx) => {
    const [clash] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.slug)).limit(1);
    if (clash) throw new ValidationFailure({ slug: ["Slug already used."] });
    const [row] = await tx.insert(categories).values(input).returning();
    await writeAudit(tx, actor, "category.create", "category", row.id, undefined, input);
    return row;
  });
}

export async function updateCategory(actor: Actor, id: string, raw: unknown) {
  const input = parseOrThrow(categoryInputSchema, raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!before) throw new ValidationFailure({ form: ["Category not found."] });
    const [clash] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.slug, input.slug), ne(categories.id, id))).limit(1);
    if (clash) throw new ValidationFailure({ slug: ["Slug already used."] });
    const [after] = await tx.update(categories).set({ ...input, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    await writeAudit(tx, actor, "category.update", "category", id, before, after);
    return after;
  });
}

export async function updateHomepageSection(
  actor: Actor,
  key: string,
  input: { isVisible: boolean; sortOrder: number; maxItems: number; minItems: number; title: string },
) {
  if (!input.title.trim() || input.maxItems < 1 || input.maxItems > 24 || input.minItems < 1 || input.minItems > input.maxItems) {
    throw new ValidationFailure({ form: ["Title is required; 1 ≤ minimum ≤ maximum ≤ 24."] });
  }
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(homepageSections).where(eq(homepageSections.key, key)).limit(1);
    if (!before) throw new ValidationFailure({ form: ["Section not found."] });
    const [after] = await tx.update(homepageSections).set(input).where(eq(homepageSections.key, key)).returning();
    await writeAudit(tx, actor, "homepage.update", "homepage_section", key, before, after);
    return after;
  });
}

export async function listCompaniesWithStructure() {
  const [companyRows, productRows, planRows] = await Promise.all([
    db.select().from(companies).orderBy(asc(companies.name)),
    db.select().from(products).orderBy(asc(products.name)),
    db.select().from(plans).orderBy(asc(plans.name)),
  ]);
  return companyRows.map((c) => ({
    ...c,
    products: productRows
      .filter((p) => p.companyId === c.id)
      .map((p) => ({ ...p, plans: planRows.filter((pl) => pl.productId === p.id) })),
  }));
}
