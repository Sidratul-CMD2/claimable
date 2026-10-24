/**
 * Captures desktop and mobile screenshots of key pages and reports browser errors and
 * horizontal overflow. Uses the locally installed Google Chrome via playwright-core.
 *   bun run screenshots                      # against http://localhost:3000
 *   BASE_URL=http://localhost:3001 bun run screenshots
 *   CHROME_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader" bun run screenshots   # software WebGL
 * Output: artifacts/screenshots/<name>-<viewport>.png
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "artifacts/screenshots";
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : "";
const PAGES: [string, string][] = (process.env.PAGES ? JSON.parse(process.env.PAGES) : null) ?? [
  ["home", "/"],
  ["deals", "/deals"],
  ["deals-bd", "/deals?country=BD"],
  ["deals-list", "/deals?view=list&sort=lowest_price"],
  ["detail-spotify", "/deals/spotify-premium-student-us?country=US"],
  ["detail-adobe-co", "/deals/adobe-creative-cloud-pro-students-colombia?country=CO"],
  ["detail-google-ai-bd", "/deals/google-ai-plus-students-bangladesh?country=BD"],
  ["students", "/students"],
  ["free-trials", "/free-trials"],
  ["category-hosting", "/categories/hosting"],
  ["companies", "/companies"],
  ["company-apple", "/companies/apple"],
  ["calendar", "/calendar"],
  ["submit", "/submit"],
  ["methodology", "/methodology"],
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: (process.env.CHROME_ARGS ?? "").split(" ").filter(Boolean) });
let problems = 0;
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: process.env.REDUCED_MOTION ? "reduce" : "no-preference" });
  const page = await context.newPage();
  for (const [name, path] of PAGES) {
    const errors: string[] = [];
    const onError = (e: Error) => errors.push(e.message.slice(0, 200));
    const onConsole = (m: { type(): string; text(): string }) => {
      if (m.type() !== "error") return;
      const text = m.text();
      // For hydration mismatches, keep React's +/- diff lines so the cause is visible.
      const diff = /hydrat/i.test(text) ? text.split("\n").filter((l) => /^\s*[+-]\s/.test(l)).slice(0, 6).join(" ⏎ ") : "";
      errors.push(text.slice(0, 160) + (diff ? ` [diff: ${diff}]` : ""));
    };
    page.on("pageerror", onError);
    page.on("console", onConsole);
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    // caret "initial": the default ("hide") writes inline styles onto inputs, which React reports
    // as a hydration mismatch when a slow page is still hydrating.
    await page.screenshot({ path: `${OUT}/${name}-${vp.name}${SUFFIX}.png`, fullPage: process.env.FULL_PAGE === "1", caret: "initial" });
    const issues = [res?.status() !== 200 ? `HTTP ${res?.status()}` : "", overflow > 0 ? `overflow ${overflow}px` : "", ...errors].filter(Boolean);
    if (issues.length) problems++;
    console.log(`${issues.length ? "✗" : "✓"} ${vp.name.padEnd(7)} ${path}${issues.length ? `  — ${issues.join(" | ")}` : ""}`);
    page.off("pageerror", onError);
    page.off("console", onConsole);
  }
  await context.close();
}
await browser.close();
console.log(problems ? `\n${problems} page/viewport combination(s) had issues.` : "\nNo browser errors or overflow detected.");
process.exitCode = problems ? 1 : 0;
