/**
 * DEVELOPMENT / TEST FIXTURES — fictional companies on the reserved `.example` TLD.
 *
 * Every record is flagged `is_fixture` and is invisible to public queries unless
 * SHOW_FIXTURES=1 outside production. Seeding refuses to run when NODE_ENV=production.
 * Fixtures exist to exercise every card variant and state in tests and screenshots; they are
 * never presented as real offers.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "../../src/server/db";
import { categories, companies, offers, promotionalEvents } from "../../src/server/db/schema";
import { attachSource, addCoupon, createOffer, recordVerification, setAvailability, setPublicationStatus } from "../../src/server/services/admin-offers";
import { createCompany, createPlan, createProduct, recordListPrice } from "../../src/server/services/admin-catalog";
import { SYSTEM_ACTOR, type Actor } from "../../src/server/services/audit";

const actor: Actor = { ...SYSTEM_ACTOR, label: "Fixture seed" };
const DAY = 86_400_000;

export async function seedFixtures(now: Date = new Date()) {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed fixtures in production.");
  const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.isFixture, true)).limit(1);
  if (existing.length) return { skipped: true as const };

  const cats = await db.select().from(categories);
  const cat = (...slugs: string[]) => cats.filter((c) => slugs.includes(c.slug)).map((c) => c.id);
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

  // 1. Student offer, worldwide except one country.
  const labs = await createCompany(actor, { name: "Fixture Labs", websiteUrl: "https://fixture-labs.example", description: "Fictional note-taking company used for tests.", allowedDomains: ["fixture-labs.example"], categoryIds: cat("productivity", "education") }, { isFixture: true });
  const notes = await createProduct(actor, { companyId: labs.id, name: "Fixture Notes", platforms: ["web", "macos", "windows"] });
  const notesPro = await createPlan(actor, { productId: notes.id, name: "Pro", officialPricingUrl: "https://fixture-labs.example/pricing" });
  await recordListPrice(actor, { planId: notesPro.id, amountMinor: 800, currency: "USD", interval: "month", observedAt: daysAgo(5), sourceUrl: "https://fixture-labs.example/pricing", isReliable: true });
  const student = await createOffer(actor, {
    companyId: labs.id, productId: notes.id, planId: notesPro.id,
    title: "Fixture Notes Pro free for students", benefit: "Free for 12 months", summary: "Students at accredited institutions get the Pro plan free for a year.",
    offerType: "student", availability: "active", riskTier: "evergreen", customerEligibility: "new_customers",
    studentRequired: true, studentAction: "verify", studentVerificationProvider: "Example Student Verify", studentEmailRequired: "yes",
    studentRequirements: "Currently enrolled at an accredited college or university.", institutionTypes: "Universities and colleges",
    maxEligibleDuration: "Up to 4 years with yearly re-verification", verificationRenewal: "Re-verify every 12 months",
    defaultCountryStatus: "unknown", currency: "USD", promoPriceMinor: 0, promoInterval: "month", promoDurationMonths: 12,
    renewalPriceMinor: 800, renewalInterval: "month", autoRenews: "yes", cancellationTerms: "Cancel any time from account settings.",
    redemptionUrl: "https://fixture-labs.example/students", officialTermsUrl: "https://fixture-labs.example/students/terms",
    knownLimitations: "Fixture data.", platforms: ["web", "macos", "windows"], categoryIds: cat("productivity", "education"),
    rules: [
      { scope: "global", countryCode: null, regionCode: null, status: "confirmed_eligible", note: "Terms say available worldwide except where listed." },
      { scope: "country", countryCode: "DE", regionCode: null, status: "confirmed_ineligible", note: "Excluded in the terms." },
    ],
  });

  // 2. Coupon with a reliable reference price (computable savings).
  const cloud = await createCompany(actor, { name: "Fixture Cloud", websiteUrl: "https://fixture-cloud.example", allowedDomains: ["fixture-cloud.example"], categoryIds: cat("hosting", "development") }, { isFixture: true });
  const host = await createProduct(actor, { companyId: cloud.id, name: "Fixture Hosting", platforms: ["web"] });
  const starter = await createPlan(actor, { productId: host.id, name: "Starter (annual)" });
  await recordListPrice(actor, { planId: starter.id, amountMinor: 10000, currency: "USD", interval: "year", observedAt: daysAgo(3), sourceUrl: "https://fixture-cloud.example/pricing", isReliable: true });
  const coupon = await createOffer(actor, {
    companyId: cloud.id, productId: host.id, planId: starter.id,
    title: "20% off the first year of Fixture Hosting", benefit: "20% off your first year", offerType: "coupon", availability: "active",
    riskTier: "high", customerEligibility: "new_customers", currency: "USD", promoPriceMinor: 8000, promoInterval: "year", promoDurationMonths: 12,
    upfrontPaymentMinor: 8000, renewalPriceMinor: 10000, renewalInterval: "year", autoRenews: "yes", advertisedDiscountPercent: 20,
    redemptionUrl: "https://fixture-cloud.example/signup", officialTermsUrl: "https://fixture-cloud.example/promo-terms",
    endsAt: new Date(now.getTime() + 10 * DAY), endsAtConfirmed: true, categoryIds: cat("hosting"),
    rules: [
      { scope: "country", countryCode: "US", regionCode: null, status: "confirmed_eligible" },
      { scope: "country", countryCode: "BD", regionCode: null, status: "likely_eligible", note: "Checkout accepted a Bangladeshi address in testing; not stated in the terms." },
    ],
    conditions: [{ kind: "no_stacking", description: "Cannot be combined with other codes." }],
  });

  // 3. Free trial with renewal price.
  const studio = await createCompany(actor, { name: "Fixture Studio", websiteUrl: "https://fixture-studio.example", allowedDomains: ["fixture-studio.example"], categoryIds: cat("design", "video-audio") }, { isFixture: true });
  const trial = await createOffer(actor, {
    companyId: studio.id, title: "Fixture Studio 14-day free trial", benefit: "14 days free", offerType: "free_trial", availability: "active",
    customerEligibility: "new_customers", trialDays: 14, currency: "USD", renewalPriceMinor: 1500, renewalInterval: "month", autoRenews: "yes",
    paymentMethodNote: "Card required to start the trial.", redemptionUrl: "https://fixture-studio.example/trial", categoryIds: cat("design", "ai"),
  });

  // 4. Expired offer (history retained).
  const vpn = await createCompany(actor, { name: "Fixture VPN", websiteUrl: "https://fixture-vpn.example", allowedDomains: ["fixture-vpn.example"], categoryIds: cat("security") }, { isFixture: true });
  const expired = await createOffer(actor, {
    companyId: vpn.id, title: "Fixture VPN autumn sale", benefit: "60% off two years", offerType: "direct", availability: "active",
    advertisedDiscountPercent: 60, redemptionUrl: "https://fixture-vpn.example/sale", startsAt: daysAgo(40), endsAt: daysAgo(10), endsAtConfirmed: true,
    categoryIds: cat("security"),
  });

  // 5. Draft — must never be public.
  await createOffer(actor, {
    companyId: vpn.id, title: "Fixture VPN draft offer", benefit: "Draft benefit", offerType: "direct", redemptionUrl: "https://fixture-vpn.example/draft", categoryIds: cat("security"),
  });

  // 6. Lifetime deal, unverified.
  const lifetime = await createOffer(actor, {
    companyId: studio.id, title: "Fixture Studio lifetime licence", benefit: "Lifetime licence for $49", offerType: "lifetime", availability: "unknown",
    currency: "USD", promoPriceMinor: 4900, promoInterval: "one_time", lifetimeTerms: "Includes updates for version 2.x only.",
    redemptionUrl: "https://fixture-studio.example/lifetime", categoryIds: cat("design"),
  });

  // 7. Promotional credit for new customers.
  const credits = await createOffer(actor, {
    companyId: cloud.id, title: "$200 Fixture Cloud credit for new accounts", benefit: "$200 credit for 60 days", offerType: "promo_credit", availability: "active",
    customerEligibility: "new_customers", currency: "USD", creditAmountMinor: 20000, creditValidity: "Expires 60 days after sign-up",
    redemptionUrl: "https://fixture-cloud.example/credits", categoryIds: cat("hosting", "ai"),
    rules: [{ scope: "global", countryCode: null, regionCode: null, status: "unknown" }],
  });

  const published = [student, coupon, trial, expired, lifetime, credits];
  for (const o of published) {
    const domain = o === student ? "fixture-labs.example" : o === trial || o === lifetime ? "fixture-studio.example" : o === expired ? "fixture-vpn.example" : "fixture-cloud.example";
    await attachSource(actor, { offerId: o.id, url: `https://${domain}/terms/${o.slug}`, sourceType: "official_promo_page", title: "Official terms (fixture)", isOfficial: true, role: "terms", expectedMarkers: [] });
  }
  await addCoupon(actor, { offerId: coupon.id, code: "FIXTURE20", status: "officially_published", description: "Annual plans only" });
  await addCoupon(actor, { offerId: coupon.id, code: "FIXTUREOLD", status: "unverified" });
  const verified = [student, coupon, trial, credits];
  for (const o of verified) {
    await recordVerification(actor, { offerId: o.id, state: "officially_confirmed", method: "editorial_official_page_review", evidenceUrl: `https://example.com/evidence/${o.slug}`, note: "Fixture evidence", verifiedAt: daysAgo(o === credits ? 45 : 3) });
  }
  await recordVerification(actor, { offerId: expired.id, state: "evidence_supported", method: "editorial_official_page_review", evidenceUrl: "https://example.com/evidence/vpn", verifiedAt: daysAgo(30) });
  for (const o of published) {
    const result = await setPublicationStatus(actor, o.id, "published");
    if (!result.ok) throw new Error(`Fixture ${o.slug} failed to publish: ${result.problems.join("; ")}`);
  }
  await setAvailability(actor, expired.id, "expired", "Fixture: confirmed end date passed.");

  // Calendar fixtures: two historical Black Fridays (enables a prediction) and one confirmed event.
  const year = now.getUTCFullYear();
  await db.insert(promotionalEvents).values([
    { companyId: vpn.id, title: "Fixture VPN Black Friday", kind: "historical", occasion: "black_friday", startsOn: `${year - 2}-11-25`, endsOn: `${year - 2}-12-02`, sourceUrl: "https://fixture-vpn.example/blog/bf-old", isPublished: true, isFixture: true },
    { companyId: vpn.id, title: "Fixture VPN Black Friday", kind: "historical", occasion: "black_friday", startsOn: `${year - 1}-11-25`, endsOn: `${year - 1}-12-02`, sourceUrl: "https://fixture-vpn.example/blog/bf", isPublished: true, isFixture: true },
    { companyId: studio.id, title: "Fixture Studio anniversary sale", kind: "confirmed", occasion: "anniversary", startsOn: new Date(now.getTime() + 20 * DAY).toISOString().slice(0, 10), endsOn: new Date(now.getTime() + 27 * DAY).toISOString().slice(0, 10), sourceUrl: "https://fixture-studio.example/news/anniversary", isPublished: true, isFixture: true },
  ]);

  return { skipped: false as const, companies: 4, offers: 7 };
}

/** Removes all fixture data (test teardown / dev cleanup). */
export async function removeFixtures() {
  const ids = (await db.select({ id: companies.id }).from(companies).where(eq(companies.isFixture, true))).map((c) => c.id);
  if (!ids.length) return;
  await db.delete(offers).where(inArray(offers.companyId, ids));
  await db.delete(companies).where(inArray(companies.id, ids));
}
