import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET as goRoute } from "@/app/go/[slug]/route";
import { EMPTY_FILTERS } from "@/lib/filters";
import { closeDb, db } from "@/server/db";
import { analyticsEvents, auditLogs, categories, monitoringJobs, offerRevisions, offers, pricePoints } from "@/server/db/schema";
import { addCoupon, attachSource, createOffer, recordVerification, setPublicationStatus, updateOffer, ValidationFailure } from "@/server/services/admin-offers";
import { createCompany, createPlan, createProduct, recordListPrice } from "@/server/services/admin-catalog";
import { getOfferDetail } from "@/server/services/offer-detail";
import { searchOffers } from "@/server/services/search";
import { makeStaff, resetDatabase } from "./helpers";

let admin: Awaited<ReturnType<typeof makeStaff>>;
let offerId = "";
let slug = "";
let baseInput: Record<string, unknown>;

beforeAll(async () => {
  await resetDatabase();
  admin = await makeStaff("admin");
});
afterAll(closeDb);

describe("vertical slice: admin creates → visitor discovers → claims", () => {
  test("admin creates company, product, plan, list price and offer; it persists with audit + revision", async () => {
    const [ai] = await db.select().from(categories).where(eq(categories.slug, "design"));
    const company = await createCompany(admin, {
      name: "Figment Design",
      websiteUrl: "https://www.figment.example",
      allowedDomains: ["figment.example"],
      categoryIds: [ai.id],
    });
    const product = await createProduct(admin, { companyId: company.id, name: "Figment Canvas", platforms: ["web"] });
    const plan = await createPlan(admin, { productId: product.id, name: "Professional" });
    await recordListPrice(admin, {
      planId: plan.id,
      amountMinor: 1500,
      currency: "USD",
      interval: "month",
      observedAt: new Date(),
      sourceUrl: "https://www.figment.example/pricing",
      isReliable: true,
    });
    baseInput = {
      companyId: company.id,
      productId: product.id,
      planId: plan.id,
      title: "Figment Canvas Professional at half price",
      benefit: "50% off for 6 months",
      offerType: "direct",
      availability: "active",
      customerEligibility: "new_customers",
      currency: "USD",
      promoPriceMinor: 750,
      promoInterval: "month",
      promoDurationMonths: 6,
      renewalPriceMinor: 1500,
      renewalInterval: "month",
      autoRenews: "yes",
      redemptionUrl: "https://www.figment.example/promo",
      categoryIds: [ai.id],
      rules: [
        { scope: "country", countryCode: "US", regionCode: null, status: "confirmed_eligible" },
        { scope: "country", countryCode: "IN", regionCode: null, status: "confirmed_ineligible" },
        { scope: "country", countryCode: "BD", regionCode: null, status: "likely_eligible" },
      ],
    };
    const result = await createOffer(admin, baseInput);
    offerId = result.id;
    slug = result.slug;
    expect(slug).toBe("figment-design-figment-canvas-professional-at-half-price");

    const [row] = await db.select().from(offers).where(eq(offers.id, offerId));
    expect(row.publicationStatus).toBe("draft");
    expect(row.verificationState).toBe("unverified");
    expect(row.searchText).toContain("figment");
    expect(row.createdBy).toBe(admin.id!);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.entityId, offerId));
    expect(audits.map((a) => a.action)).toContain("offer.create");
    const revisions = await db.select().from(offerRevisions).where(eq(offerRevisions.offerId, offerId));
    expect(revisions[0].changeType).toBe("created");
    const prices = await db.select().from(pricePoints).where(eq(pricePoints.offerId, offerId));
    expect(prices.map((p) => p.kind).sort()).toEqual(["promotional", "renewal"]);
  });

  test("a redemption URL outside the approved domains is rejected", async () => {
    await expect(createOffer(admin, { ...baseInput, title: "Other", redemptionUrl: "https://evil.example/promo" })).rejects.toBeInstanceOf(ValidationFailure);
  });

  test("an equivalent offer is flagged as a duplicate", async () => {
    try {
      await createOffer(admin, baseInput);
      throw new Error("expected duplicate");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailure);
      expect(Object.keys((error as ValidationFailure).fieldErrors)).toContain("allowDuplicate");
    }
  });

  test("drafts are not public and cannot be published without a source", async () => {
    const result = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figment" }, country: null });
    expect(result.total).toBe(0);
    const publish = await setPublicationStatus(admin, offerId, "published");
    expect(publish.ok).toBe(false);
    if (!publish.ok) expect(publish.problems.join(" ")).toContain("source");
  });

  test("after adding a source and evidence the offer publishes and a monitoring job is scheduled", async () => {
    await attachSource(admin, {
      offerId,
      url: "https://www.figment.example/promo",
      sourceType: "official_promo_page",
      isOfficial: true,
      role: "terms",
      expectedMarkers: ["50% off"],
    });
    await recordVerification(admin, {
      offerId,
      state: "officially_confirmed",
      method: "editorial_official_page_review",
      evidenceUrl: "https://www.figment.example/promo",
      verifiedAt: new Date(),
    });
    const publish = await setPublicationStatus(admin, offerId, "published");
    expect(publish).toEqual({ ok: true });
    const [job] = await db.select().from(monitoringJobs).where(eq(monitoringJobs.uniqueKey, `offer_check:${offerId}`));
    expect(job.enabled).toBe(true);
  });

  test("re-attaching an unchanged source writes no history; changed expected terms write one update", async () => {
    const sourceRevisions = async () =>
      (await db.select().from(offerRevisions).where(eq(offerRevisions.offerId, offerId))).filter((r) => r.changeType.startsWith("source_")).map((r) => r.changeType);
    const before = await sourceRevisions();
    const input = { offerId, url: "https://www.figment.example/promo", sourceType: "official_promo_page", isOfficial: true, role: "terms", expectedMarkers: ["50% off"] };
    await attachSource(admin, input);
    expect(await sourceRevisions()).toEqual(before);
    await attachSource(admin, { ...input, expectedMarkers: ["50% off", "6 months"] });
    expect(await sourceRevisions()).toEqual([...before, "source_updated"]);
    await attachSource(admin, { ...input, expectedMarkers: ["50% off"] });
  });

  test("search tolerates a typo and applies country eligibility", async () => {
    const typo = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figmnet canvas" }, country: "US" });
    expect(typo.items.map((i) => i.slug)).toContain(slug);
    expect(typo.items[0].country.label).toBe("Available in United States");

    const india = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figment" }, country: "IN" });
    expect(india.total).toBe(0);
    expect(india.hiddenRestricted).toBe(1);
    const indiaIncl = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figment", includeRestricted: true }, country: "IN" });
    expect(indiaIncl.items[0].country.label).toBe("Not available in India");

    const bd = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figment" }, country: "BD" });
    expect(bd.items[0].country.label).toBe("Likely in Bangladesh");
    const bdStrict = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figment", eligibleOnly: true }, country: "BD" });
    expect(bdStrict.total).toBe(0);

    const unknown = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "figment" }, country: "FR" });
    expect(unknown.items[0].country.label).toBe("Not confirmed for France");
  });

  test("detail exposes renewal pricing, savings, eligibility and the correct action", async () => {
    const detail = await getOfferDetail(slug, "US");
    expect(detail).not.toBeNull();
    const d = detail!;
    expect(d.card.priceLine).toBe("$7.50 USD/mo");
    expect(d.card.priceDetail).toBe("for 6 months");
    expect(d.card.renewalLine).toBe("Then $15 USD/mo");
    expect(d.decision.savings.savings).toMatchObject({ kind: "introductory", percent: 50 });
    expect(d.decision.projection.first12Months?.amountMinor).toBe(6 * 750 + 6 * 1500);
    expect(d.decision.user.status).toBe("eligible");
    expect(d.card.conditions).toContain("New customers only");
    expect(d.card.redemption).toMatchObject({ kind: "claim", label: "Claim Deal", href: `/go/${slug}` });
    expect(d.card.verification.label).toBe("Officially confirmed");
  });

  test("claim redirects only to the approved merchant and records an outbound interaction", async () => {
    const res = await goRoute(new NextRequest(`http://localhost/go/${slug}`), { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://www.figment.example/promo");
    const events = await db.select().from(analyticsEvents).where(and(eq(analyticsEvents.offerId, offerId), eq(analyticsEvents.type, "claim")));
    expect(events).toHaveLength(1);

    // A tampered redemption URL is refused even if it reached the database.
    await db.update(offers).set({ redemptionUrl: "https://attacker.example/x" }).where(eq(offers.id, offerId));
    const blocked = await goRoute(new NextRequest(`http://localhost/go/${slug}`), { params: Promise.resolve({ slug }) });
    expect(blocked.headers.get("location")).toContain(`/deals/${slug}?redirect=blocked`);
    await db.update(offers).set({ redemptionUrl: "https://www.figment.example/promo" }).where(eq(offers.id, offerId));
  });

  test("editing pricing writes a price_changed revision and price history", async () => {
    await updateOffer(admin, offerId, { ...baseInput, renewalPriceMinor: 1600 });
    const revisions = await db.select().from(offerRevisions).where(eq(offerRevisions.offerId, offerId));
    expect(revisions.some((r) => r.changeType === "price_changed")).toBe(true);
    const renewals = await db.select().from(pricePoints).where(and(eq(pricePoints.offerId, offerId), eq(pricePoints.kind, "renewal")));
    expect(renewals.map((r) => r.amountMinor).sort()).toEqual([1500, 1600]);
  });

  test("coupon offers can be revealed only through the offer's coupons", async () => {
    const coupon = await createOffer(admin, { ...baseInput, title: "Figment code", offerType: "coupon", redemptionUrl: "https://www.figment.example/code", rules: [] });
    await addCoupon(admin, { offerId: coupon.id, code: "FIGMENT50", status: "officially_published" });
    await attachSource(admin, { offerId: coupon.id, url: "https://www.figment.example/code", sourceType: "official_promo_page", isOfficial: true, role: "coupon" });
    expect((await setPublicationStatus(admin, coupon.id, "published")).ok).toBe(true);
    const detail = await getOfferDetail(coupon.slug, null);
    expect(detail?.card.redemption).toMatchObject({ kind: "reveal", label: "Reveal Code", secondaryLabel: "Visit website" });
    const found = await searchOffers({ filters: { ...EMPTY_FILTERS, q: "FIGMENT50" }, country: null });
    expect(found.items.map((i) => i.slug)).toContain(coupon.slug);
  });
});
