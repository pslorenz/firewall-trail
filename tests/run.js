/* SPDX-License-Identifier: GPL-3.0-or-later */
/* run.js: open the game in a headless browser and run tests/checks.js.
 *   npm install          (once, installs Playwright)
 *   npx playwright install chromium   (once, downloads the browser)
 *   npm test             (quick run)
 *   npm test -- --full   (more years, nights and event rounds)
 *   npm test -- --seed 12345   (repeat a run exactly)
 * Exits with code 1 if anything fails, so it works in CI. */
const path = require("path");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const full = args.includes("--full");
const options = full ? { years: 6, nights: 200, eventRounds: 8 } : { years: 2, nights: 40, eventRounds: 2 };
if (opt("--seed")) options.seed = Number(opt("--seed"));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  page.on("console", m => {
    // Fonts load from Google; offline runs can't reach them, and that's fine
    if (m.type() === "error" && !/Failed to load resource|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text())) pageErrors.push(m.text());
  });
  // Keep achievements and other saved progress from leaking between runs
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto("file://" + path.resolve(__dirname, "../docs/index.html"));
  await page.addScriptTag({ path: path.resolve(__dirname, "checks.js") });
  const report = await page.evaluate(o => FTChecks.run(o), options);
  await browser.close();

  for (const r of report.results) {
    console.log(`${r.ok ? "  ok  " : "  FAIL"}  ${r.name}${r.detail && (!r.ok || process.env.VERBOSE) ? `\n        ${r.detail.replace(/\n/g, "\n        ")}` : ""}`);
  }
  for (const e of pageErrors) console.log(`  FAIL  Page error: ${e}`);
  const failed = report.failed + pageErrors.length;
  console.log(`\n${report.passed} passed, ${failed} failed in ${(report.ms / 1000).toFixed(1)}s (seed ${report.seed}${full ? ", full" : ""})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
