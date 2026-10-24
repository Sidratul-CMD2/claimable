/**
 * Browser flows against a production build (`bun run build`, then `bun run test:e2e`).
 * The server runs on the test database; every record here is fictional test data on
 * `.example` domains, and requests to the fictional merchant are answered locally.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { closeDb, db } from "@/server/db";
import { analyticsEvents, categories, companies, connectors, coupons, homepageSections, offers, reviewItems } from "@/server/db/schema";
import { addCoupon, attachSource, createOffer, recordVerification, setPublicationStatus } from "@/server/services/admin-offers";
import { openReviewItem } from "@/server/services/review";
import { makeStaff, resetDatabase } from "../integration/helpers";
import { BASE_URL, ensureServer } from "./server";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MERCHANT = "https://www.lumen.example";
const OFFER_TITLE = "Lumen Notes Pro at half price";
const OFFER_BENEFIT = "50% off Pro for 6 months";
const COUPON_CODE = "LUMEN-E2E-50";

let stopServer = () => {};
let browser: Browser;
let admin: Awaited<ReturnType<typeof makeStaff>>;
let editor: Awaited<ReturnType<typeof makeStaff>>;
const pageErrors: string[] = [];
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  stopServer = await ensureServer();
  await resetDatabase();
  admin = await makeStaff("admin");
  editor = await makeStaff("editor");
  // Software WebGL so the decorative canvases really run (needed for the reduced-motion check).
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
});

afterAll(async () => {
  await browser?.close();
  stopServer();
  await closeDb();
});

async function open(options: BrowserContextOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 1000 }, ...options });
  contexts.push(context);
  // The fictional merchant domain doesn't resolve; answer for it so claim redirects can be observed.
  await context.route(`${MERCHANT}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Merchant</title><h1>Merchant page</h1>" }));
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));
  return { context, page };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/, { waitUntil: "commit" });
}

/** Polls until `fn` returns a truthy value (for effects that land after the UI updates). */
async function until<T>(fn: () => Promise<T>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value || Date.now() > deadline) return value;
    await Bun.sleep(200);
  }
}

const offerByTitle = async (title: string) => (await db.select().from(offers).where(eq(offers.title, title)))[0];

async function chooseCountry(page: Page, name: string) {
  await page.getByRole("button", { name: /Choose your country|Change country/ }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByPlaceholder("Search countries").fill(name);
  await dialog.getByRole("option", { name }).click();
  await page.locator("dialog[open]").waitFor({ state: "detached" });
}

describe("admin publishes an offer through the dashboard", () => {
  let page: Page;
  beforeAll(async () => ({ page } = await open()));

  test("signed-out visitors are sent to login, and a wrong password is refused", async () => {
    await page.goto("/admin/offers");
    expect(new URL(page.url()).pathname).toBe("/admin/login");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("Incorrect email or password.").waitFor();
    expect(new URL(page.url()).pathname).toBe("/admin/login");
  });

  test("admin signs in and creates a company", async () => {
    await signIn(page, admin.email, admin.password);
    await page.goto("/admin/companies");
    await page.getByLabel("Name", { exact: true }).fill("Lumen Notes");
    await page.getByLabel("Official website").fill(MERCHANT);
    await page.getByLabel("Approved redirect domains").fill("lumen.example");
    await page.getByLabel("Productivity & Collaboration").check();
    await page.getByRole("button", { name: "Create company" }).click();
    await page.getByRole("link", { name: "Lumen Notes" }).waitFor();
    const [company] = await db.select().from(companies).where(eq(companies.name, "Lumen Notes"));
    expect(company.allowedDomains).toEqual(["lumen.example"]);
  });

  test("admin creates a draft offer through the form; unknowns stay empty", async () => {
    await page.goto("/admin/offers/new");
    await page.locator("#companyId").selectOption({ label: "Lumen Notes" });
    await page.locator("#offerType").selectOption("direct");
    await page.locator("#availability").selectOption("active");
    await page.locator("#title").fill(OFFER_TITLE);
    await page.locator("#benefit").fill(OFFER_BENEFIT);
    await page.getByLabel("Productivity & Collaboration").check();
    await page.locator("#currency").fill("USD");
    await page.locator("#promoPrice").fill("4.50");
    await page.locator("#promoInterval").selectOption("month");
    await page.locator("#promoDurationMonths").fill("6");
    await page.locator("#renewalPrice").fill("9");
    await page.locator("#renewalInterval").selectOption("month");
    await page.locator("#autoRenews").selectOption("yes");
    await page.locator("#cancellationTerms").fill("Cancel any time in account settings.");
    await page.locator("#eligibleCountries").fill("US, CA");
    await page.locator("#ineligibleCountries").fill("BD");
    await page.locator("#customerEligibility").selectOption("new_customers");
    await page.locator("#redemptionUrl").fill(`${MERCHANT}/pro?promo=half`);
    await page.locator("#officialTermsUrl").fill(`${MERCHANT}/pro/terms`);
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.waitForURL(/\/admin\/offers\/[0-9a-f-]+\?created=1$/);
    await page.getByText("Publishing is blocked until:").waitFor();

    const row = await offerByTitle(OFFER_TITLE);
    expect(row).toMatchObject({ publicationStatus: "draft", verificationState: "unverified", promoPriceMinor: 450, renewalPriceMinor: 900, createdBy: admin.id });
    expect(row.upfrontPaymentMinor).toBeNull();
    expect(row.taxNote).toBeNull();
  });

  test("admin attaches an official source, records verification and publishes", async () => {
    const sources = page.locator("section[aria-labelledby=sources-heading]");
    await sources.locator("input[name=url]").fill(`${MERCHANT}/pro/terms`);
    await sources.locator("select[name=sourceType]").selectOption("official_promo_page");
    await sources.locator("select[name=role]").selectOption("terms");
    await sources.locator("input[name=title]").fill("Lumen Pro offer terms");
    await sources.getByLabel("Controlled by the company (official source)").check();
    await sources.locator("textarea[name=expectedMarkers]").fill("50% off");
    await sources.getByRole("button", { name: "Attach source" }).click();
    await sources.getByText("Source attached.").waitFor();

    const verification = page.locator("section[aria-labelledby=verification-heading]");
    await verification.locator("select[name=state]").selectOption("officially_confirmed");
    await verification.locator("select[name=method]").selectOption("editorial_official_page_review");
    await verification.locator("textarea[name=note]").fill("Official terms page: 50% off Pro for 6 months, new customers.");
    await verification.getByRole("button", { name: "Record verification" }).click();
    await verification.getByText("Verification recorded.").waitFor();

    await page.locator("section[aria-labelledby=publication-heading]").getByRole("button", { name: "Publish" }).click();
    const row = await until(async () => {
      const r = await offerByTitle(OFFER_TITLE);
      return r.publicationStatus === "published" ? r : null;
    });
    expect(row).toMatchObject({ publicationStatus: "published", verificationState: "officially_confirmed" });
    await page.getByRole("link", { name: "View public page" }).waitFor();
  });
});

describe("visitor discovers, checks eligibility and claims", () => {
  let context: BrowserContext;
  let page: Page;
  beforeAll(async () => ({ context, page } = await open()));

  test("search finds the offer; country choice shows eligibility and hides confirmed-unavailable offers", async () => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search deals" }).first();
    await search.fill("lumen");
    await search.press("Enter");
    await page.waitForURL(/\/deals\?q=lumen/);
    await page.getByText(OFFER_BENEFIT).first().waitFor();
    expect(await page.getByRole("combobox", { name: "Search deals" }).first().inputValue()).toBe("lumen");

    await chooseCountry(page, "Canada");
    await page.getByText("eligibility shown for Canada").waitFor();
    await page.getByText("Available in Canada").first().waitFor();

    await chooseCountry(page, "Bangladesh");
    await page.getByText(/confirmed as not available in Bangladesh is hidden/).waitFor();
    await page.getByRole("link", { name: "Show it" }).click();
    await page.getByText("Not available in Bangladesh").first().waitFor();

    await chooseCountry(page, "Canada");
    await page.getByText("eligibility shown for Canada").waitFor();
  });

  test("the offer page shows renewal pricing and restrictions before Claim", async () => {
    await page.getByRole("link", { name: OFFER_BENEFIT }).first().click();
    await page.waitForURL(/\/deals\/lumen-notes-/);
    const panel = page.getByRole("complementary", { name: "Claim this offer" });
    await panel.getByText("Then $9 USD/mo").waitFor();
    await panel.getByText("Confirmed eligible").waitFor();
    await panel.getByText("New customers only").waitFor();
    await page.getByText("Savings aren't calculated", { exact: false }).waitFor();
    const renewalRow = page.locator("tr, div").filter({ hasText: /^Renewal price/ }).first();
    expect(await renewalRow.textContent()).toContain("$9 USD/mo");
  });

  test("Claim Deal opens the approved merchant and is recorded as an outbound interaction", async () => {
    const offer = await offerByTitle(OFFER_TITLE);
    const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: /Claim Deal/ }).first().click()]);
    await popup.waitForURL(`${MERCHANT}/pro?promo=half`);
    await popup.close();
    const claims = await until(() => db.select().from(analyticsEvents).where(and(eq(analyticsEvents.offerId, offer.id), eq(analyticsEvents.type, "claim"))).then((r) => r.length && r));
    expect(claims && claims[0].countryCode).toBe("CA");
  });

  test("a visitor report reaches the review queue without changing the offer", async () => {
    await page.getByText("Report a problem with this offer").click();
    await page.getByLabel("Wrong discount amount").check();
    await page.getByRole("button", { name: "Send report" }).click();
    await page.getByRole("status").filter({ hasText: /review/i }).first().waitFor();
    const offer = await offerByTitle(OFFER_TITLE);
    expect(offer).toMatchObject({ publicationStatus: "published", availability: "active", verificationState: "officially_confirmed" });
    const items = await db.select().from(reviewItems).where(and(eq(reviewItems.offerId, offer.id), eq(reviewItems.status, "open")));
    expect(items).toHaveLength(1);
  });
});

describe("coupon reveal and copy", () => {
  let couponSlug = "";
  beforeAll(async () => {
    const [company] = await db.select().from(companies).where(eq(companies.name, "Lumen Notes"));
    const [productivity] = await db.select().from(categories).where(eq(categories.slug, "productivity"));
    const created = await createOffer(admin, {
      companyId: company.id,
      title: "Lumen Notes annual plan code",
      benefit: "20% off the annual plan",
      offerType: "coupon",
      availability: "active",
      customerEligibility: "unknown",
      redemptionUrl: `${MERCHANT}/checkout`,
      categoryIds: [productivity.id],
      rules: [],
    });
    couponSlug = created.slug;
    await addCoupon(admin, { offerId: created.id, code: COUPON_CODE, status: "officially_published", sourceUrl: `${MERCHANT}/codes` });
    await attachSource(admin, { offerId: created.id, url: `${MERCHANT}/codes`, sourceType: "official_promo_page", isOfficial: true, role: "coupon" });
    await recordVerification(admin, { offerId: created.id, state: "officially_confirmed", method: "editorial_official_page_review", evidenceUrl: `${MERCHANT}/codes`, verifiedAt: new Date() });
    expect((await setPublicationStatus(admin, created.id, "published")).ok).toBe(true);
  });

  test("Reveal Code shows the code and Copy puts it on the clipboard with feedback", async () => {
    const { page } = await open({ permissions: ["clipboard-read", "clipboard-write"] });
    await page.goto(`/deals/${couponSlug}`);
    expect(await page.getByText(COUPON_CODE).count()).toBe(0);
    await page.getByRole("button", { name: "Reveal Code" }).first().click();
    await page.getByLabel(`Coupon code ${COUPON_CODE}`).first().waitFor();
    await page.getByRole("button", { name: `Copy code ${COUPON_CODE}` }).first().click();
    await page.getByRole("button", { name: `Copied ${COUPON_CODE}` }).first().waitFor();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(COUPON_CODE);
    await page.getByRole("link", { name: /Visit website/ }).first().waitFor();

    const offer = await offerByTitle("Lumen Notes annual plan code");
    const types = await until(async () => {
      const rows = await db.select({ type: analyticsEvents.type }).from(analyticsEvents).where(eq(analyticsEvents.offerId, offer.id));
      const set = new Set(rows.map((r) => r.type));
      return set.has("reveal") && set.has("copy") ? set : null;
    });
    expect(types).not.toBeNull();
  });

  test("when the clipboard is unavailable, the page says so and the code stays selectable", async () => {
    const { context, page } = await open();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) }, configurable: true });
    });
    await page.goto(`/deals/${couponSlug}`);
    await page.getByRole("button", { name: "Reveal Code" }).first().click();
    await page.getByRole("button", { name: `Copy code ${COUPON_CODE}` }).first().click();
    await page.getByText("Copying isn't available here").first().waitFor();
    await page.getByLabel(`Coupon code ${COUPON_CODE}`).first().waitFor();
  });

  test("without JavaScript the code is still reachable", async () => {
    const { page } = await open({ javaScriptEnabled: false });
    await page.goto(`/deals/${couponSlug}?reveal=1#codes`);
    await page.getByText(COUPON_CODE).first().waitFor();
  });
});

describe("mobile filter drawer", () => {
  test("Apply sets filters, chips can be removed, and filters survive visiting an offer", async () => {
    const { page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto("/deals");
    await page.getByText("2 offers").first().waitFor();
    await page.getByRole("button", { name: "Filters" }).click();
    const drawer = page.locator("dialog[open]");
    await drawer.getByLabel("Coupons").check();
    // Staged only: nothing changes until Apply.
    expect(page.url()).not.toContain("type=coupon");
    await drawer.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(/type=coupon/);
    await page.getByText("1 offer", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Remove filter: Coupons" }).waitFor();

    await page.getByRole("link", { name: "20% off the annual plan" }).first().click();
    await page.waitForURL(/\/deals\/lumen-notes-/);
    await page.goBack();
    await page.waitForURL(/type=coupon/);
    await page.getByRole("link", { name: "Remove filter: Coupons" }).waitFor();

    await page.getByRole("link", { name: "Clear all" }).click();
    await page.waitForURL((url) => !url.search.includes("type="));
    await page.getByText("2 offers").first().waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

describe("keyboard and reduced motion", () => {
  test("the skip link comes first, focus is visible, and search works from the keyboard", async () => {
    const { page } = await open();
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return { text: el.textContent?.trim(), visible: style.outlineStyle !== "none" || style.boxShadow !== "none", width: el.getBoundingClientRect().width };
    });
    expect(focused.text).toBe("Skip to content");
    expect(focused.width).toBeGreaterThan(1);
    await page.keyboard.press("Enter");
    expect(new URL(page.url()).hash).toBe("#main");

    await page.getByRole("combobox", { name: "Search deals" }).first().focus();
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(ring).toBe(true);
    await page.keyboard.type("annual plan");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/deals\?q=annual/);
    await page.getByText("20% off the annual plan").first().waitFor();
  });

  test("with reduced motion, decorative canvases give way to static fallbacks", async () => {
    const decorativeCanvases = (page: Page) => page.evaluate(() => [...document.querySelectorAll("canvas")].filter((c) => !c.closest("nav")).length);

    const animated = await open();
    await animated.page.goto("/");
    await animated.page.waitForTimeout(1500);
    expect(await decorativeCanvases(animated.page)).toBeGreaterThan(0);

    const still = await open({ reducedMotion: "reduce" });
    await still.page.goto("/");
    await still.page.waitForTimeout(1500);
    expect(await decorativeCanvases(still.page)).toBe(0);
    await still.page.getByRole("link", { name: "Claimable home" }).waitFor();
    await still.page.getByRole("heading", { level: 1 }).first().waitFor();
  });
});

describe("expired offers", () => {
  test("an offer past its confirmed end date shows the expired state and no claim action", async () => {
    const [company] = await db.select().from(companies).where(eq(companies.name, "Lumen Notes"));
    const created = await createOffer(admin, {
      companyId: company.id,
      title: "Lumen Notes summer promotion",
      benefit: "3 months free",
      offerType: "direct",
      availability: "expired",
      customerEligibility: "new_customers",
      redemptionUrl: `${MERCHANT}/summer`,
      endsAt: "2026-08-31",
      endsAtConfirmed: true,
      rules: [],
    });
    await attachSource(admin, { offerId: created.id, url: `${MERCHANT}/summer`, sourceType: "official_promo_page", isOfficial: true, role: "terms" });
    expect((await setPublicationStatus(admin, created.id, "published")).ok).toBe(true);

    const { page } = await open();
    await page.goto(`/deals/${created.slug}`);
    await page.getByText("This offer has expired").waitFor();
    const panel = page.getByRole("complementary", { name: "Claim this offer" });
    await panel.getByText("This promotion is no longer available.").waitFor();
    expect(await panel.getByRole("link").count()).toBe(0);

    await page.goto("/deals?q=summer");
    expect(await page.getByText("3 months free").count()).toBe(0);
  });
});

describe("deals calendar", () => {
  test("editors record sourced historical events; two years of history yields a labelled prediction; unpublished events stay hidden", async () => {
    const { page } = await open();
    await signIn(page, editor.email, editor.password);
    await page.goto("/admin/calendar");
    const addEvent = async (title: string, startsOn: string, endsOn: string, occasion: string, publish: boolean) => {
      await page.locator("#new-event-companyId").selectOption({ label: "Lumen Notes" });
      await page.locator("#new-event-title").fill(title);
      await page.locator("#new-event-kind").selectOption("historical");
      await page.locator("#new-event-occasion").selectOption(occasion);
      await page.locator("#new-event-startsOn").fill(startsOn);
      await page.locator("#new-event-endsOn").fill(endsOn);
      await page.locator("#new-event-sourceUrl").fill(`${MERCHANT}/blog/${startsOn}`);
      if (publish) await page.locator("#new-event-isPublished-on").check();
      await page.getByRole("button", { name: "Add event" }).click();
      await page.locator("li").filter({ hasText: title }).first().waitFor();
    };
    await addEvent("Lumen Notes Black Friday 2024", "2024-11-29", "2024-12-02", "black_friday", true);
    await addEvent("Lumen Notes Black Friday 2025", "2025-11-28", "2025-12-01", "black_friday", true);
    await addEvent("Lumen Notes spring sale 2025", "2025-04-01", "2025-04-07", "other", false);

    const visitor = await open();
    await visitor.page.goto("/calendar?view=history");
    await visitor.page.getByText("Lumen Notes Black Friday 2024").waitFor();
    await visitor.page.getByText("Lumen Notes Black Friday 2025").waitFor();
    expect(await visitor.page.getByText("Lumen Notes spring sale 2025").count()).toBe(0);

    await visitor.page.goto("/calendar?view=upcoming");
    // Predictions are labelled as such and never presented as announced sale dates.
    const predicted = visitor.page.locator("li").filter({ hasText: "Predicted — not announced" }).filter({ hasText: "Lumen Notes" }).first();
    await predicted.waitFor();
    expect(await predicted.textContent()).toContain("around 27 Nov 2026");
  });
});

describe("staff roles and the review queue", () => {
  test("editors can't open user management or run jobs; admins can", async () => {
    const { page } = await open();
    await signIn(page, editor.email, editor.password);
    expect(await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Users" }).count()).toBe(0);
    await page.goto("/admin/users");
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/admin?denied=1");
    await page.goto("/admin/sources");
    await page.getByRole("heading", { name: /Scheduled jobs/ }).waitFor();
    expect(await page.getByRole("button", { name: "Run now" }).count()).toBe(0);

    const adminView = await open();
    await signIn(adminView.page, admin.email, admin.password);
    await adminView.page.goto("/admin/sources");
    expect(await adminView.page.getByRole("button", { name: "Run now" }).count()).toBeGreaterThan(0);
  });

  test("an editor closes the visitor's report with a note", async () => {
    const { page } = await open();
    await signIn(page, editor.email, editor.password);
    await page.goto("/admin/review");
    const item = page.locator("li").filter({ hasText: `Wrong discount amount: ${OFFER_TITLE}` });
    await item.locator("select[name=status]").selectOption("resolved");
    await item.locator("select[name=reportOutcome]").selectOption("invalid");
    await item.locator("input[name=note]").fill("Checked the official terms: the discount shown is correct.");
    await item.getByRole("button", { name: "Close item" }).click();
    const offer = await offerByTitle(OFFER_TITLE);
    const open_ = await until(async () => {
      const rows = await db.select().from(reviewItems).where(and(eq(reviewItems.offerId, offer.id), eq(reviewItems.status, "open")));
      return rows.length === 0;
    });
    expect(open_).toBe(true);
  });
});

describe("other admin forms", () => {
  let page: Page;
  beforeAll(async () => {
    ({ page } = await open());
    await signIn(page, admin.email, admin.password);
  });

  test("an admin adds a coupon code through the offer page", async () => {
    const offer = await offerByTitle("Lumen Notes annual plan code");
    await page.goto(`/admin/offers/${offer.id}`);
    const panel = page.locator("section[aria-labelledby=coupons-heading]");
    await panel.locator("input[name=code]").fill("LUMEN-E2E-ADMIN");
    await panel.locator("select[name=status]").last().selectOption("officially_published");
    await panel.locator("input[name=sourceUrl]").fill(`${MERCHANT}/codes`);
    await panel.getByRole("button", { name: "Add code" }).click();
    await panel.locator("code", { hasText: "LUMEN-E2E-ADMIN" }).waitFor();
    const codes = await db.select({ code: coupons.code }).from(coupons).where(eq(coupons.offerId, offer.id));
    expect(codes.map((c) => c.code).sort()).toEqual([COUPON_CODE, "LUMEN-E2E-ADMIN"].sort());
  });

  test("hiding a category removes it from public navigation", async () => {
    await page.goto("/admin/categories");
    const row = page.locator("li").filter({ has: page.locator('input[name="slug"][value="entertainment"]') });
    await row.getByLabel("Visible").uncheck();
    await row.getByRole("button", { name: "Save" }).click();
    await row.getByText("Category saved.").waitFor();
    const visitor = await open();
    await visitor.page.goto("/deals");
    const nav = visitor.page.getByRole("complementary", { name: "Browse and filter" });
    await nav.getByRole("link", { name: "Security & Privacy" }).waitFor();
    expect(await nav.getByRole("link", { name: "Entertainment" }).count()).toBe(0);
  });

  test("homepage sections can be renamed", async () => {
    await page.goto("/admin/homepage");
    const row = page.locator("li").filter({ hasText: "student" }).first();
    await row.getByLabel("Title of student").fill("Student offers we checked");
    await row.getByRole("button", { name: "Save" }).click();
    await row.getByText("Section saved.").waitFor();
    const [section] = await db.select().from(homepageSections).where(eq(homepageSections.key, "student"));
    expect(section.title).toBe("Student offers we checked");
  });

  test("connectors without approved permission can't be enabled; approved ones can be reconfigured", async () => {
    await page.goto("/admin/sources");
    const partner = page.locator("article").filter({ has: page.getByRole("heading", { name: "Authorized partner feed (JSON)" }) });
    await partner.locator("summary", { hasText: "Configure" }).click();
    await partner.getByLabel("Enabled").check();
    await partner.getByRole("button", { name: "Save connector" }).click();
    await partner.getByText("Only connectors with approved permission can be enabled.").waitFor();

    const monitor = page.locator("article").filter({ has: page.getByRole("heading", { name: "Official page monitor" }) });
    await monitor.locator("summary", { hasText: "Configure" }).click();
    await monitor.getByLabel("Run every (minutes)").fill("720");
    await monitor.getByRole("button", { name: "Save connector" }).click();
    await monitor.getByText("Connector updated.").waitFor();
    const [row] = await db.select().from(connectors).where(eq(connectors.key, "official-page-monitor"));
    expect(row.intervalMinutes).toBe(720);
  });

  test("an admin creates a staff user who can then sign in", async () => {
    await page.goto("/admin/users");
    const email = `new-editor-${crypto.randomUUID().slice(0, 6)}@test.local`;
    await page.getByLabel("Name").fill("New Editor");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Role").selectOption("editor");
    await page.getByLabel("Initial password (min. 12 characters)").fill("another-correct-horse-12");
    await page.getByRole("button", { name: "Create user" }).click();
    await page.getByText("User created.", { exact: false }).waitFor();

    const fresh = await open();
    await signIn(fresh.page, email, "another-correct-horse-12");
    expect(await fresh.page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Users" }).count()).toBe(0);
  });
});

describe("page health", () => {
  test("unmatched URLs return a 404 page with the site navigation", async () => {
    const { page } = await open();
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await page.getByText("We couldn't find that page").waitFor();
    await page.getByRole("link", { name: "Claimable home" }).waitFor();
    await page.getByRole("link", { name: "Explore deals" }).waitFor();
  });

  test("no uncaught errors in any page during the run", () => {
    expect(pageErrors).toEqual([]);
  });

  test("admin pages have unique element ids (labels point at the right fields)", async () => {
    const { page } = await open();
    await signIn(page, admin.email, admin.password);
    const offer = await offerByTitle(OFFER_TITLE);
    const [company] = await db.select().from(companies).where(eq(companies.name, "Lumen Notes"));
    // Repeated forms only collide when there are several items, so make sure there are.
    for (const n of [1, 2]) {
      await openReviewItem(db, { kind: "markers_missing", priority: 2, title: `E2E review item ${n}`, details: "Test item.", dedupeKey: `e2e:${n}`, offerId: offer.id });
    }
    const paths = ["/admin", "/admin/offers", "/admin/offers/new", `/admin/offers/${offer.id}`, "/admin/companies", `/admin/companies/${company.id}`, "/admin/review", "/admin/sources", "/admin/calendar", "/admin/homepage", "/admin/categories", "/admin/users"];
    const duplicates: Record<string, string[]> = {};
    for (const path of paths) {
      await page.goto(path);
      const dupes = await page.evaluate(() => {
        const counts = new Map<string, number>();
        for (const el of document.querySelectorAll("[id]")) counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
        return [...counts].filter(([, n]) => n > 1).map(([id]) => id);
      });
      if (dupes.length) duplicates[path] = dupes;
    }
    expect(duplicates).toEqual({});
  });
});
