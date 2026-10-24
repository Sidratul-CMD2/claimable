import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { seedFixtures } from "../../data/fixtures";
import { EMPTY_FILTERS } from "@/lib/filters";
import { authenticate, createSession, validateSessionToken } from "@/server/auth/sessions";
import { closeDb, db } from "@/server/db";
import { offers, reviewItems, sessions, submissions, userReports } from "@/server/db/schema";
import { submitDeal, submitReport } from "@/server/services/community";
import { searchOffers } from "@/server/services/search";
import { setUserDisabled } from "@/server/services/users";
import { makeStaff, resetDatabase } from "./helpers";

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});
afterAll(closeDb);

describe("fixtures", () => {
  test("seeded fixtures cover every state and are flagged", async () => {
    const rows = await db.select().from(offers);
    expect(rows.length).toBe(7);
    expect(rows.every((r) => r.isFixture)).toBe(true);
    expect(rows.filter((r) => r.publicationStatus === "published")).toHaveLength(6);
    expect(rows.find((r) => r.availability === "expired")).toBeDefined();
  });

  test("fixtures are invisible unless SHOW_FIXTURES=1", async () => {
    const before = process.env.SHOW_FIXTURES;
    process.env.SHOW_FIXTURES = "0";
    expect((await searchOffers({ filters: EMPTY_FILTERS, country: null })).total).toBe(0);
    process.env.SHOW_FIXTURES = "1";
    const visible = await searchOffers({ filters: EMPTY_FILTERS, country: null });
    // 6 published, minus 1 expired (hidden by default) = 5; drafts never appear.
    expect(visible.total).toBe(5);
    expect(visible.items.some((i) => i.title.includes("draft"))).toBe(false);
    process.env.SHOW_FIXTURES = before;
  });

  test("expired offers are hidden by default and shown when requested", async () => {
    const withExpired = await searchOffers({ filters: { ...EMPTY_FILTERS, includeExpired: true }, country: null });
    expect(withExpired.total).toBe(6);
    expect(withExpired.items.at(-1)?.availability.state).toBe("expired");
  });

  test("country filtering: Germany is excluded from the student offer", async () => {
    const de = await searchOffers({ filters: { ...EMPTY_FILTERS, student: "only" }, country: "DE" });
    expect(de.total).toBe(0);
    expect(de.hiddenRestricted).toBe(1);
    const bd = await searchOffers({ filters: { ...EMPTY_FILTERS, student: "only" }, country: "BD" });
    expect(bd.items[0].country.label).toBe("Available in Bangladesh");
    expect(bd.items[0].redemption.label).toBe("Verify student eligibility");
  });
});

describe("user reports never change status on their own", () => {
  const slug = async () => (await db.select({ slug: offers.slug }).from(offers).where(eq(offers.offerType, "coupon")))[0].slug;

  test("one report enters review at low priority; offer status unchanged", async () => {
    const s = await slug();
    const before = (await db.select().from(offers).where(eq(offers.slug, s)))[0];
    const result = await submitReport({ offerSlug: s, reason: "code_not_working", couponCode: "FIXTURE20" }, "fp-1");
    expect(result.ok).toBe(true);
    const after = (await db.select().from(offers).where(eq(offers.slug, s)))[0];
    expect(after.availability).toBe(before.availability);
    expect(after.verificationState).toBe(before.verificationState);
    const [item] = await db.select().from(reviewItems).where(and(eq(reviewItems.kind, "user_reports"), eq(reviewItems.status, "open")));
    expect(item.priority).toBe(3);
  });

  test("the same visitor reporting twice is deduplicated", async () => {
    await submitReport({ offerSlug: await slug(), reason: "code_not_working" }, "fp-1");
    expect(await db.select().from(userReports)).toHaveLength(1);
  });

  test("three distinct visitors escalate the review item (still no status change)", async () => {
    const s = await slug();
    await submitReport({ offerSlug: s, reason: "code_not_working" }, "fp-2");
    await submitReport({ offerSlug: s, reason: "code_not_working" }, "fp-3");
    const items = await db.select().from(reviewItems).where(and(eq(reviewItems.kind, "user_reports"), eq(reviewItems.status, "open")));
    expect(items).toHaveLength(1);
    expect(items[0].priority).toBe(1);
    expect((await db.select().from(offers).where(eq(offers.slug, s)))[0].availability).toBe("active");
  });

  test("honeypot submissions are dropped silently and rate limits apply", async () => {
    const s = await slug();
    const bot = await submitReport({ offerSlug: s, reason: "broken_link", website: "spam" }, "bot");
    expect(bot.ok).toBe(true);
    expect((await db.select().from(userReports).where(eq(userReports.fingerprint, "bot"))).length).toBe(0);
    const reasons = ["broken_link", "wrong_discount", "promotion_expired", "country_unavailable", "incorrect_renewal_info", "other"] as const;
    const results = [];
    for (const reason of reasons) results.push(await submitReport({ offerSlug: s, reason }, "fp-flood"));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5].ok).toBe(false);
  });
});

describe("community submissions", () => {
  test("go to review unpublished, with URL validation", async () => {
    const bad = await submitDeal({ companyName: "X", offerUrl: "http://insecure.example", benefit: "Free stuff" }, "sub-1");
    expect(bad.ok).toBe(false);
    const good = await submitDeal({ companyName: "Example Co", offerUrl: "https://example.com/deal", benefit: "Free month for new users" }, "sub-1");
    expect(good.ok).toBe(true);
    const [row] = await db.select().from(submissions);
    expect(row.status).toBe("new");
    expect((await db.select().from(reviewItems).where(eq(reviewItems.kind, "submission"))).length).toBe(1);
  });
});

describe("staff authentication", () => {
  test("valid credentials authenticate; wrong password and disabled users do not", async () => {
    const editor = await makeStaff("editor");
    expect(await authenticate(editor.email, editor.password)).toMatchObject({ role: "editor" });
    expect(await authenticate(editor.email, "wrong-password-123")).toBeNull();
    expect(await authenticate("nobody@test.local", editor.password)).toBeNull();
    const { token } = await createSession(editor.id!, "test-agent");
    expect(await validateSessionToken(token)).toMatchObject({ email: editor.email });
    expect(await validateSessionToken("forged-token")).toBeNull();
    // Sessions are stored hashed, never raw.
    expect((await db.select().from(sessions)).every((s) => s.id !== token)).toBe(true);
    await setUserDisabled({ id: null, email: "test" }, editor.id!, true);
    expect(await validateSessionToken(token)).toBeNull();
    expect(await authenticate(editor.email, editor.password)).toBeNull();
  });

  test("expired sessions are rejected", async () => {
    const admin = await makeStaff("admin");
    const { token } = await createSession(admin.id!, null);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, admin.id!));
    expect(await validateSessionToken(token)).toBeNull();
  });
});
