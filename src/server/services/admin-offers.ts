/**
 * Offer management use cases. Every function expects an already-authorized actor
 * (server actions call requireRole first), validates input, writes an audit log and,
 * for offer changes, an append-only revision.
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { PublicationStatus } from "@/lib/enums";
import { OFFER_TYPE_LABEL } from "@/lib/labels";
import { db, type DbOrTx } from "../db";
import {
  categories,
  companies,
  coupons,
  offerCategories,
  offerConditions,
  offerCountryRules,
  offerSources,
  offers,
  plans,
  pricePoints,
  products,
  reviewItems,
  sources,
  verificationRecords,
} from "../db/schema";
import { dedupeKey, possibleDuplicate, type DedupeInput } from "../domain/dedupe";
import { canTransition, publishProblems } from "../domain/lifecycle";
import { resolveRedirect } from "../domain/url-safety";
import { syncOfferCheckJob } from "../jobs/schedule";
import {
  couponInputSchema,
  offerInputSchema,
  sourceInputSchema,
  verificationInputSchema,
  type OfferInput,
} from "../validation/admin";
import { classifyChanges, diffRecords, writeAudit, writeRevision, type Actor } from "./audit";
import { buildSearchText } from "./search";

export class ValidationFailure extends Error {
  constructor(public readonly fieldErrors: Record<string, string[]>, message = "Please correct the highlighted fields.") {
    super(message);
    this.name = "ValidationFailure";
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueOfferSlug(tx: DbOrTx, base: string, excludeId?: string): Promise<string> {
  const root = base || "offer";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const [hit] = await tx
      .select({ id: offers.id })
      .from(offers)
      .where(excludeId ? and(eq(offers.slug, candidate), ne(offers.id, excludeId)) : eq(offers.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  throw new Error("Could not allocate a unique slug.");
}

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join(".") || "form";
      (errors[key] ??= []).push(issue.message);
    }
    throw new ValidationFailure(errors);
  }
  return result.data;
}

function dedupeInputFrom(o: OfferInput, couponCodes: string[]): DedupeInput {
  return {
    companyId: o.companyId,
    productId: o.productId,
    planId: o.planId,
    offerType: o.offerType,
    couponCodes,
    redemptionUrl: o.redemptionUrl,
    promoPriceMinor: o.promoPriceMinor,
    currency: o.currency,
    promoInterval: o.promoInterval,
    advertisedDiscountPercent: o.advertisedDiscountPercent,
    trialDays: o.trialDays,
    creditAmountMinor: o.creditAmountMinor,
    studentRequired: o.studentRequired || o.offerType === "student",
    customerEligibility: o.customerEligibility,
    countryRules: o.rules,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
  };
}

async function assertHierarchy(tx: DbOrTx, o: OfferInput) {
  const [company] = await tx.select().from(companies).where(eq(companies.id, o.companyId)).limit(1);
  if (!company) throw new ValidationFailure({ companyId: ["Company not found."] });
  if (o.productId) {
    const [product] = await tx.select().from(products).where(eq(products.id, o.productId)).limit(1);
    if (!product || product.companyId !== o.companyId) throw new ValidationFailure({ productId: ["Product does not belong to this company."] });
  }
  if (o.planId) {
    if (!o.productId) throw new ValidationFailure({ planId: ["Choose the product before the plan."] });
    const [plan] = await tx.select().from(plans).where(eq(plans.id, o.planId)).limit(1);
    if (!plan || plan.productId !== o.productId) throw new ValidationFailure({ planId: ["Plan does not belong to this product."] });
  }
  const redirect = resolveRedirect(o.redemptionUrl, company.allowedDomains);
  if (!redirect.ok) {
    throw new ValidationFailure({
      redemptionUrl: [`The redemption URL must be on an approved domain for ${company.name}: ${company.allowedDomains.join(", ") || "none configured"}.`],
    });
  }
  return company;
}

function offerColumns(o: OfferInput) {
  return {
    companyId: o.companyId,
    productId: o.productId,
    planId: o.planId,
    title: o.title,
    benefit: o.benefit,
    summary: o.summary,
    offerType: o.offerType,
    availability: o.availability,
    riskTier: o.riskTier,
    customerEligibility: o.customerEligibility,
    studentRequired: o.studentRequired || o.offerType === "student",
    studentAction: o.studentAction,
    studentVerificationProvider: o.studentVerificationProvider,
    studentEmailRequired: o.studentEmailRequired,
    studentRequirements: o.studentRequirements,
    institutionTypes: o.institutionTypes,
    maxEligibleDuration: o.maxEligibleDuration,
    verificationRenewal: o.verificationRenewal,
    defaultCountryStatus: o.defaultCountryStatus,
    currency: o.currency,
    promoPriceMinor: o.promoPriceMinor,
    promoInterval: o.promoInterval,
    promoDurationMonths: o.promoDurationMonths,
    upfrontPaymentMinor: o.upfrontPaymentMinor,
    renewalPriceMinor: o.renewalPriceMinor,
    renewalInterval: o.renewalInterval,
    autoRenews: o.autoRenews,
    cancellationTerms: o.cancellationTerms,
    taxNote: o.taxNote,
    paymentMethodNote: o.paymentMethodNote,
    appliesToExistingAccounts: o.appliesToExistingAccounts,
    advertisedDiscountPercent: o.advertisedDiscountPercent,
    trialDays: o.trialDays,
    creditAmountMinor: o.creditAmountMinor,
    creditValidity: o.creditValidity,
    lifetimeTerms: o.lifetimeTerms,
    redemptionUrl: o.redemptionUrl,
    isAffiliate: o.isAffiliate,
    affiliateDisclosure: o.affiliateDisclosure,
    isSponsored: o.isSponsored,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    endsAtConfirmed: o.endsAtConfirmed,
    officialTermsUrl: o.officialTermsUrl,
    termsSummary: o.termsSummary,
    knownLimitations: o.knownLimitations,
    platforms: o.platforms,
    monitorIntervalHours: o.monitorIntervalHours,
  };
}

async function replaceRelations(tx: DbOrTx, offerId: string, o: OfferInput) {
  await tx.delete(offerCategories).where(eq(offerCategories.offerId, offerId));
  if (o.categoryIds.length) {
    const valid = await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, o.categoryIds));
    if (valid.length) await tx.insert(offerCategories).values(valid.map((c) => ({ offerId, categoryId: c.id })));
  }
  await tx.delete(offerCountryRules).where(eq(offerCountryRules.offerId, offerId));
  const seen = new Set<string>();
  const rules = o.rules.filter((r) => {
    const key = `${r.scope}:${r.countryCode ?? ""}:${r.regionCode ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (rules.length) {
    await tx.insert(offerCountryRules).values(
      rules.map((r) => ({
        offerId,
        scope: r.scope,
        countryCode: r.scope === "country" ? r.countryCode : null,
        regionCode: r.scope === "region" ? r.regionCode : null,
        status: r.status,
        note: r.note,
        sourceUrl: r.sourceUrl,
      })),
    );
  }
  await tx.delete(offerConditions).where(eq(offerConditions.offerId, offerId));
  if (o.conditions.length) {
    await tx.insert(offerConditions).values(o.conditions.map((c) => ({ offerId, kind: c.kind, description: c.description })));
  }
}

/** Recomputes the denormalised search text and dedupe key for an offer. */
export async function refreshDerivedFields(tx: DbOrTx, offerId: string) {
  const [row] = await tx
    .select({ offer: offers, companyName: companies.name, productName: products.name, planName: plans.name })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .leftJoin(products, eq(products.id, offers.productId))
    .leftJoin(plans, eq(plans.id, offers.planId))
    .where(eq(offers.id, offerId));
  if (!row) return;
  const [cats, codes, rules] = await Promise.all([
    tx
      .select({ name: categories.name })
      .from(offerCategories)
      .innerJoin(categories, eq(categories.id, offerCategories.categoryId))
      .where(eq(offerCategories.offerId, offerId)),
    tx.select({ code: coupons.code, status: coupons.status }).from(coupons).where(eq(coupons.offerId, offerId)),
    tx.select().from(offerCountryRules).where(eq(offerCountryRules.offerId, offerId)),
  ]);
  const o = row.offer;
  const searchText = buildSearchText({
    companyName: row.companyName,
    productName: row.productName,
    planName: row.planName,
    title: o.title,
    benefit: o.benefit,
    summary: o.summary,
    offerTypeLabel: OFFER_TYPE_LABEL[o.offerType],
    categoryNames: cats.map((c) => c.name),
    couponCodes: codes.filter((c) => c.status !== "invalid").map((c) => c.code),
    studentProvider: o.studentVerificationProvider,
  });
  const key = dedupeKey({
    companyId: o.companyId,
    productId: o.productId,
    planId: o.planId,
    offerType: o.offerType,
    couponCodes: codes.map((c) => c.code),
    redemptionUrl: o.redemptionUrl,
    promoPriceMinor: o.promoPriceMinor,
    currency: o.currency,
    promoInterval: o.promoInterval,
    advertisedDiscountPercent: o.advertisedDiscountPercent,
    trialDays: o.trialDays,
    creditAmountMinor: o.creditAmountMinor,
    studentRequired: o.studentRequired,
    customerEligibility: o.customerEligibility,
    countryRules: rules,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
  });
  await tx.update(offers).set({ searchText, dedupeKey: key }).where(eq(offers.id, offerId));
}

/** Records promotional/renewal price observations when they change, building price history. */
async function recordPriceHistory(tx: DbOrTx, actor: Actor, offerId: string, before: typeof offers.$inferSelect | null, after: typeof offers.$inferSelect) {
  const now = new Date();
  const changed = (keys: (keyof typeof after)[]) => !before || keys.some((k) => String(before[k]) !== String(after[k]));
  const rows: (typeof pricePoints.$inferInsert)[] = [];
  if (after.promoPriceMinor != null && after.currency && after.promoInterval && changed(["promoPriceMinor", "currency", "promoInterval"])) {
    rows.push({ offerId, kind: "promotional", amountMinor: after.promoPriceMinor, currency: after.currency, interval: after.promoInterval, observedAt: now, sourceUrl: after.officialTermsUrl, recordedBy: actor.id, isReliable: false, note: "Recorded from offer terms" });
  }
  if (after.renewalPriceMinor != null && after.currency && after.renewalInterval && changed(["renewalPriceMinor", "currency", "renewalInterval"])) {
    rows.push({ offerId, kind: "renewal", amountMinor: after.renewalPriceMinor, currency: after.currency, interval: after.renewalInterval, observedAt: now, sourceUrl: after.officialTermsUrl, recordedBy: actor.id, isReliable: false, note: "Recorded from offer terms" });
  }
  if (rows.length) await tx.insert(pricePoints).values(rows);
}

export interface SaveOfferResult {
  id: string;
  slug: string;
  duplicates: { id: string; slug: string; title: string; exact: boolean }[];
}

async function findDuplicates(tx: DbOrTx, o: OfferInput, excludeId?: string) {
  const key = dedupeKey(dedupeInputFrom(o, []));
  const candidates = await tx
    .select({ id: offers.id, slug: offers.slug, title: offers.title, dedupeKey: offers.dedupeKey, redemptionUrl: offers.redemptionUrl, offerType: offers.offerType, companyId: offers.companyId })
    .from(offers)
    .where(and(eq(offers.companyId, o.companyId), ne(offers.publicationStatus, "archived"), excludeId ? ne(offers.id, excludeId) : sql`true`));
  const mine = dedupeInputFrom(o, []);
  return candidates
    .filter((c) => c.dedupeKey === key || possibleDuplicate(mine, { ...mine, companyId: c.companyId, offerType: c.offerType, redemptionUrl: c.redemptionUrl }))
    .map((c) => ({ id: c.id, slug: c.slug, title: c.title, exact: c.dedupeKey === key }));
}

export async function createOffer(actor: Actor, raw: unknown, opts: { isFixture?: boolean } = {}): Promise<SaveOfferResult> {
  const input = parseOrThrow(offerInputSchema, raw);
  return db.transaction(async (tx) => {
    const company = await assertHierarchy(tx, input);
    const duplicates = await findDuplicates(tx, input);
    if (duplicates.some((d) => d.exact) && !input.allowDuplicate) {
      throw new ValidationFailure(
        { allowDuplicate: [`An equivalent offer already exists: ${duplicates.filter((d) => d.exact).map((d) => d.title).join(", ")}. Add a source to it instead, or confirm this is distinct.`] },
        "Possible duplicate offer.",
      );
    }
    const slug = await uniqueOfferSlug(tx, input.slug ?? slugify(`${company.name} ${input.title}`));
    const [row] = await tx
      .insert(offers)
      .values({ ...offerColumns(input), slug, dedupeKey: "pending", isFixture: opts.isFixture ?? company.isFixture, createdBy: actor.id, updatedBy: actor.id })
      .returning();
    await replaceRelations(tx, row.id, input);
    await refreshDerivedFields(tx, row.id);
    await recordPriceHistory(tx, actor, row.id, null, row);
    await writeRevision(tx, row.id, actor, "created", {}, "Offer created");
    await writeAudit(tx, actor, "offer.create", "offer", row.id, undefined, { slug, title: input.title });
    return { id: row.id, slug, duplicates };
  });
}

export async function updateOffer(actor: Actor, id: string, raw: unknown): Promise<SaveOfferResult> {
  const input = parseOrThrow(offerInputSchema, raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(offers).where(eq(offers.id, id)).limit(1);
    if (!before) throw new ValidationFailure({ form: ["Offer not found."] });
    await assertHierarchy(tx, input);
    const beforeRules = await tx.select().from(offerCountryRules).where(eq(offerCountryRules.offerId, id));
    const beforeConditions = await tx.select().from(offerConditions).where(eq(offerConditions.offerId, id));
    const slug = input.slug && input.slug !== before.slug ? await uniqueOfferSlug(tx, input.slug, id) : before.slug;
    const [after] = await tx
      .update(offers)
      .set({ ...offerColumns(input), slug, updatedBy: actor.id, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    await replaceRelations(tx, id, input);
    await refreshDerivedFields(tx, id);
    await recordPriceHistory(tx, actor, id, before, after);

    const ruleText = (rules: { scope: string; countryCode: string | null; regionCode: string | null; status: string }[]) =>
      rules.map((r) => `${r.scope}:${r.countryCode ?? r.regionCode ?? "*"}=${r.status}`).sort();
    const changes = diffRecords(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
    const rulesBefore = ruleText(beforeRules);
    const rulesAfter = ruleText(input.rules);
    if (JSON.stringify(rulesBefore) !== JSON.stringify(rulesAfter)) changes.countryRules = { from: rulesBefore, to: rulesAfter };
    const condBefore = beforeConditions.map((c) => c.kind).sort();
    const condAfter = input.conditions.map((c) => c.kind).sort();
    if (JSON.stringify(condBefore) !== JSON.stringify(condAfter)) changes.conditions = { from: condBefore, to: condAfter };

    if (Object.keys(changes).length) {
      await writeRevision(tx, id, actor, classifyChanges(changes), changes);
      await writeAudit(tx, actor, "offer.update", "offer", id, pick(before, Object.keys(changes)), pick(after, Object.keys(changes)));
    }
    await syncOfferCheckJob(tx, id);
    return { id, slug, duplicates: await findDuplicates(tx, input, id) };
  });
}

function pick(row: object, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, (row as Record<string, unknown>)[k]]));
}

export async function publishCheck(tx: DbOrTx, offerId: string): Promise<string[]> {
  const [row] = await tx
    .select({ offer: offers, allowedDomains: companies.allowedDomains })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .where(eq(offers.id, offerId));
  if (!row) return ["Offer not found."];
  const [[{ sourceCount }], [{ couponCount }], [{ ruleCount }]] = await Promise.all([
    tx.select({ sourceCount: sql<number>`count(*)::int` }).from(offerSources).where(eq(offerSources.offerId, offerId)),
    tx.select({ couponCount: sql<number>`count(*)::int` }).from(coupons).where(and(eq(coupons.offerId, offerId), ne(coupons.status, "invalid"))),
    tx.select({ ruleCount: sql<number>`count(*)::int` }).from(offerCountryRules).where(eq(offerCountryRules.offerId, offerId)),
  ]);
  return publishProblems({
    title: row.offer.title,
    benefit: row.offer.benefit,
    offerType: row.offer.offerType,
    redemptionUrlApproved: resolveRedirect(row.offer.redemptionUrl, row.allowedDomains).ok,
    sourceCount,
    couponCount,
    studentRequired: row.offer.studentRequired,
    studentRequirements: row.offer.studentRequirements,
    countryRuleCount: ruleCount,
  });
}

export async function setPublicationStatus(
  actor: Actor,
  offerId: string,
  to: PublicationStatus,
  note = "",
): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(offers).where(eq(offers.id, offerId)).limit(1);
    if (!before) return { ok: false, problems: ["Offer not found."] };
    if (before.publicationStatus === to) return { ok: true };
    if (!canTransition(before.publicationStatus, to)) {
      return { ok: false, problems: [`Cannot move from ${before.publicationStatus} to ${to}.`] };
    }
    if (to === "published") {
      const problems = await publishCheck(tx, offerId);
      if (problems.length) return { ok: false, problems };
    }
    const now = new Date();
    await tx
      .update(offers)
      .set({
        publicationStatus: to,
        publishedAt: to === "published" ? (before.publishedAt ?? now) : before.publishedAt,
        archivedAt: to === "archived" ? now : null,
        updatedBy: actor.id,
        updatedAt: now,
      })
      .where(eq(offers.id, offerId));
    const changes = { publicationStatus: { from: before.publicationStatus, to } };
    await writeRevision(tx, offerId, actor, to === "published" ? "published" : to === "archived" ? "archived" : "status_changed", changes, note);
    await writeAudit(tx, actor, `offer.${to}`, "offer", offerId, { publicationStatus: before.publicationStatus }, { publicationStatus: to, note });
    await syncOfferCheckJob(tx, offerId);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function addCoupon(actor: Actor, raw: unknown) {
  const input = parseOrThrow(couponInputSchema, raw);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(coupons).where(and(eq(coupons.offerId, input.offerId), eq(coupons.code, input.code))).limit(1);
    if (existing) throw new ValidationFailure({ code: ["This code is already recorded for the offer."] });
    const now = new Date();
    const [row] = await tx
      .insert(coupons)
      .values({ ...input, firstSeenAt: now, lastSeenAt: now })
      .returning();
    await refreshDerivedFields(tx, input.offerId);
    await writeRevision(tx, input.offerId, actor, "coupon_changed", { coupon: { from: null, to: `${input.code} (${input.status})` } });
    await writeAudit(tx, actor, "coupon.create", "coupon", row.id, undefined, { offerId: input.offerId, code: input.code, status: input.status });
    return row;
  });
}

export async function updateCouponStatus(
  actor: Actor,
  couponId: string,
  status: (typeof coupons.$inferSelect)["status"],
  details: { testCountry?: string | null; testNote?: string | null } = {},
) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(coupons).where(eq(coupons.id, couponId)).limit(1);
    if (!before) throw new ValidationFailure({ form: ["Coupon not found."] });
    const now = new Date();
    await tx
      .update(coupons)
      .set({
        status,
        updatedAt: now,
        ...(status === "redemption_tested" ? { lastTestedAt: now, testCountry: details.testCountry ?? null, testNote: details.testNote ?? null } : {}),
      })
      .where(eq(coupons.id, couponId));
    await refreshDerivedFields(tx, before.offerId);
    await writeRevision(tx, before.offerId, actor, "coupon_changed", { [`coupon:${before.code}`]: { from: before.status, to: status } });
    await writeAudit(tx, actor, "coupon.status", "coupon", couponId, { status: before.status }, { status, ...details });
  });
}

export async function removeCoupon(actor: Actor, couponId: string) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(coupons).where(eq(coupons.id, couponId)).limit(1);
    if (!before) return;
    await tx.delete(coupons).where(eq(coupons.id, couponId));
    await refreshDerivedFields(tx, before.offerId);
    await writeRevision(tx, before.offerId, actor, "coupon_changed", { [`coupon:${before.code}`]: { from: before.status, to: "removed" } });
    await writeAudit(tx, actor, "coupon.delete", "coupon", couponId, before, undefined);
  });
}

// ---------------------------------------------------------------------------
// Sources and verification
// ---------------------------------------------------------------------------

export async function attachSource(actor: Actor, raw: unknown) {
  const input = parseOrThrow(sourceInputSchema, raw);
  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(sources)
      .values({ url: input.url, sourceType: input.sourceType, title: input.title, publisher: input.publisher, isOfficial: input.isOfficial })
      .onConflictDoUpdate({
        target: sources.url,
        set: { sourceType: input.sourceType, title: input.title, publisher: input.publisher, isOfficial: input.isOfficial },
      })
      .returning();
    const [existing] = await tx
      .select()
      .from(offerSources)
      .where(and(eq(offerSources.offerId, input.offerId), eq(offerSources.sourceId, source.id)))
      .limit(1);
    const sameMarkers = existing && existing.expectedMarkers.join("\n") === input.expectedMarkers.join("\n");
    // Re-attaching an unchanged link is a no-op, so the public history only shows real changes.
    if (existing && existing.role === input.role && sameMarkers) return source;
    await tx
      .insert(offerSources)
      .values({ offerId: input.offerId, sourceId: source.id, role: input.role, expectedMarkers: input.expectedMarkers })
      .onConflictDoUpdate({
        target: [offerSources.offerId, offerSources.sourceId],
        set: { role: input.role, expectedMarkers: input.expectedMarkers },
      });
    if (existing) {
      await writeRevision(tx, input.offerId, actor, "source_updated", {
        ...(existing.role !== input.role ? { role: { from: existing.role, to: input.role } } : {}),
        ...(!sameMarkers ? { expectedMarkers: { from: existing.expectedMarkers, to: input.expectedMarkers } } : {}),
      });
    } else {
      await writeRevision(tx, input.offerId, actor, "source_added", { source: { from: null, to: input.url } });
    }
    await writeAudit(tx, actor, existing ? "source.update" : "source.attach", "offer", input.offerId, existing ? { role: existing.role, expectedMarkers: existing.expectedMarkers } : undefined, input);
    await syncOfferCheckJob(tx, input.offerId);
    return source;
  });
}

export async function detachSource(actor: Actor, offerId: string, sourceId: string) {
  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
    await tx.delete(offerSources).where(and(eq(offerSources.offerId, offerId), eq(offerSources.sourceId, sourceId)));
    await writeRevision(tx, offerId, actor, "source_removed", { source: { from: source?.url ?? sourceId, to: null } });
    await writeAudit(tx, actor, "source.detach", "offer", offerId, { sourceId }, undefined);
    await syncOfferCheckJob(tx, offerId);
  });
}

/** Records evidence and moves the offer's verification state accordingly. */
export async function recordVerification(actor: Actor, raw: unknown) {
  const input = parseOrThrow(verificationInputSchema, raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(offers).where(eq(offers.id, input.offerId)).limit(1);
    if (!before) throw new ValidationFailure({ form: ["Offer not found."] });
    const [record] = await tx
      .insert(verificationRecords)
      .values({ ...input, verifiedBy: actor.id })
      .returning();
    // Coupon-level evidence does not change the offer-level state.
    if (!input.couponId) {
      await tx
        .update(offers)
        .set({
          verificationState: input.state,
          verifiedAt: input.state === "unverified" ? null : input.verifiedAt,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(offers.id, input.offerId));
      await writeRevision(tx, input.offerId, actor, "verification_recorded", {
        verificationState: { from: before.verificationState, to: input.state },
      }, input.note);
    } else if (input.state === "redemption_tested") {
      await tx
        .update(coupons)
        .set({ status: "redemption_tested", lastTestedAt: input.verifiedAt, testCountry: input.countryCode, testNote: input.note })
        .where(eq(coupons.id, input.couponId));
    }
    // Resolve open staleness reviews for the offer once fresh evidence exists.
    if (input.state !== "unverified") {
      await tx
        .update(reviewItems)
        .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: actor.id, resolutionNote: "New verification evidence recorded." })
        .where(and(eq(reviewItems.offerId, input.offerId), eq(reviewItems.kind, "stale_verification"), eq(reviewItems.status, "open")));
    }
    await writeAudit(tx, actor, "offer.verify", "offer", input.offerId, { verificationState: before.verificationState }, input);
    return record;
  });
}

export async function setAvailability(actor: Actor, offerId: string, availability: (typeof offers.$inferSelect)["availability"], note: string) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(offers).where(eq(offers.id, offerId)).limit(1);
    if (!before || before.availability === availability) return;
    await tx.update(offers).set({ availability, updatedAt: new Date(), updatedBy: actor.id }).where(eq(offers.id, offerId));
    await writeRevision(tx, offerId, actor, "status_changed", { availability: { from: before.availability, to: availability } }, note);
    await writeAudit(tx, actor, "offer.availability", "offer", offerId, { availability: before.availability }, { availability, note });
    await syncOfferCheckJob(tx, offerId);
  });
}

export { parseOrThrow };
