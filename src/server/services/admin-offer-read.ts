/** Read models for the admin offer list and editor. */
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PublicationStatus } from "@/lib/enums";
import { db } from "../db";
import {
  categories,
  companies,
  coupons,
  offerCategories,
  offerConditions,
  offerCountryRules,
  offerRevisions,
  offerSources,
  offers,
  reviewItems,
  sourceObservations,
  sources,
  verificationRecords,
} from "../db/schema";
import { effectiveVerification } from "../domain/verification";
import { fromMinorUnits, rulesToFormFields } from "../validation/offer-form";
import { listCompaniesWithStructure } from "./admin-catalog";
import { publishCheck } from "./admin-offers";

export async function listAdminOffers(filter: { status?: PublicationStatus; q?: string; freshness?: string; fixtures?: boolean }) {
  const where: SQL[] = [];
  if (filter.status) where.push(eq(offers.publicationStatus, filter.status));
  if (!filter.fixtures) where.push(eq(offers.isFixture, false));
  if (filter.q) where.push(or(ilike(offers.title, `%${filter.q}%`), ilike(companies.name, `%${filter.q}%`))!);
  const rows = await db
    .select({ offer: offers, company: companies.name })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .where(where.length ? and(...where) : sql`true`)
    .orderBy(desc(offers.updatedAt))
    .limit(500);
  const now = new Date();
  const withState = rows.map((r) => ({
    ...r,
    verification: effectiveVerification({ state: r.offer.verificationState, verifiedAt: r.offer.verifiedAt, riskTier: r.offer.riskTier }, now).state,
  }));
  return filter.freshness === "stale" ? withState.filter((r) => r.verification === "stale") : withState;
}

export async function offerFormOptions() {
  const [structure, cats] = await Promise.all([
    listCompaniesWithStructure(),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  return {
    companies: structure.map((c) => ({
      id: c.id,
      name: c.isFixture ? `${c.name} (fixture)` : c.name,
      allowedDomains: c.allowedDomains,
      products: c.products.map((p) => ({ id: p.id, name: p.name, plans: p.plans.map((pl) => ({ id: pl.id, name: pl.name })) })),
    })),
    categories: cats,
  };
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function getAdminOffer(id: string) {
  const [row] = await db.select({ offer: offers, company: companies }).from(offers).innerJoin(companies, eq(companies.id, offers.companyId)).where(eq(offers.id, id));
  if (!row) return null;
  const o = row.offer;
  const [cats, rules, conditions, couponRows, sourceRows, verifications, revisions, observations, reviews, problems] = await Promise.all([
    db.select({ id: offerCategories.categoryId }).from(offerCategories).where(eq(offerCategories.offerId, id)),
    db.select().from(offerCountryRules).where(eq(offerCountryRules.offerId, id)),
    db.select().from(offerConditions).where(eq(offerConditions.offerId, id)),
    db.select().from(coupons).where(eq(coupons.offerId, id)).orderBy(asc(coupons.createdAt)),
    db
      .select({ source: sources, role: offerSources.role, expectedMarkers: offerSources.expectedMarkers })
      .from(offerSources)
      .innerJoin(sources, eq(sources.id, offerSources.sourceId))
      .where(eq(offerSources.offerId, id)),
    db.select().from(verificationRecords).where(eq(verificationRecords.offerId, id)).orderBy(desc(verificationRecords.verifiedAt)),
    db.select().from(offerRevisions).where(eq(offerRevisions.offerId, id)).orderBy(desc(offerRevisions.changedAt)).limit(50),
    db.select().from(sourceObservations).where(eq(sourceObservations.offerId, id)).orderBy(desc(sourceObservations.observedAt)).limit(20),
    db.select().from(reviewItems).where(and(eq(reviewItems.offerId, id), eq(reviewItems.status, "open"))),
    publishCheck(db, id),
  ]);

  const values: Record<string, string | boolean | string[]> = {
    companyId: o.companyId,
    productId: o.productId ?? "",
    planId: o.planId ?? "",
    slug: o.slug,
    title: o.title,
    benefit: o.benefit,
    summary: o.summary,
    offerType: o.offerType,
    availability: o.availability,
    riskTier: o.riskTier,
    customerEligibility: o.customerEligibility,
    studentRequired: o.studentRequired,
    studentAction: o.studentAction ?? "",
    studentVerificationProvider: o.studentVerificationProvider ?? "",
    studentEmailRequired: o.studentEmailRequired,
    studentRequirements: o.studentRequirements ?? "",
    institutionTypes: o.institutionTypes ?? "",
    maxEligibleDuration: o.maxEligibleDuration ?? "",
    verificationRenewal: o.verificationRenewal ?? "",
    defaultCountryStatus: o.defaultCountryStatus,
    currency: o.currency ?? "",
    promoPrice: fromMinorUnits(o.promoPriceMinor, o.currency),
    promoInterval: o.promoInterval ?? "",
    promoDurationMonths: o.promoDurationMonths?.toString() ?? "",
    upfrontPayment: fromMinorUnits(o.upfrontPaymentMinor, o.currency),
    renewalPrice: fromMinorUnits(o.renewalPriceMinor, o.currency),
    renewalInterval: o.renewalInterval ?? "",
    autoRenews: o.autoRenews,
    cancellationTerms: o.cancellationTerms ?? "",
    taxNote: o.taxNote ?? "",
    paymentMethodNote: o.paymentMethodNote ?? "",
    appliesToExistingAccounts: o.appliesToExistingAccounts,
    advertisedDiscountPercent: o.advertisedDiscountPercent?.toString() ?? "",
    trialDays: o.trialDays?.toString() ?? "",
    creditAmount: fromMinorUnits(o.creditAmountMinor, o.currency),
    creditValidity: o.creditValidity ?? "",
    lifetimeTerms: o.lifetimeTerms ?? "",
    redemptionUrl: o.redemptionUrl,
    isAffiliate: o.isAffiliate,
    affiliateDisclosure: o.affiliateDisclosure ?? "",
    isSponsored: o.isSponsored,
    startsAt: day(o.startsAt),
    endsAt: day(o.endsAt),
    endsAtConfirmed: o.endsAtConfirmed,
    officialTermsUrl: o.officialTermsUrl ?? "",
    termsSummary: o.termsSummary ?? "",
    knownLimitations: o.knownLimitations ?? "",
    platforms: o.platforms,
    monitorIntervalHours: o.monitorIntervalHours?.toString() ?? "",
    categoryIds: cats.map((c) => c.id),
    ...rulesToFormFields(rules),
  };
  for (const c of conditions) {
    values[`condition_${c.kind}`] = true;
    values[`conditionNote_${c.kind}`] = c.description;
  }
  return {
    offer: o,
    company: row.company,
    values,
    coupons: couponRows,
    sources: sourceRows,
    verifications,
    revisions,
    observations,
    reviews,
    problems,
    verification: effectiveVerification({ state: o.verificationState, verifiedAt: o.verifiedAt, riskTier: o.riskTier }),
  };
}
