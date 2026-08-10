#!/usr/bin/env node
/**
 * Capture the documentation's widget images from the framework-free renderer.
 *
 * The feature tour shows what the controls look like, and a screenshot nobody can regenerate is a
 * claim with no way to check it. This drives the real `@modyra/plain` demo in a real browser, so
 * refreshing the images is one command and the configuration behind them is stated here rather than
 * remembered.
 *
 * The configuration is the one a reader is shown, not a test fixture: the `modern` stylesheet, the
 * live `triadic` palette, seeded `#0084ff`. The visual regression baselines under `e2e/` answer a
 * different question — did this change — and are pinned to their own themes for that reason.
 *
 *   node scripts/capture-widget-shots.mjs
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = resolve(import.meta.dirname, "..");
const TARGET = join(ROOT, "docs/assets/widgets");
const ORIGIN = process.env.MDY_DEMO_ORIGIN ?? "http://localhost:4307";

const SEED = "#0084ff";
const PALETTE = "triadic";
const THEME = "modyra-modern";

/** The kinds worth a picture. Each is shot on its own so the image shows one control, not a page. */
const WIDGETS = [
  "text",
  "number",
  "slider",
  "checkbox",
  "toggle",
  "radio-group",
  "segmented",
  "select",
  "multiselect",
  "datepicker",
  "daterange",
  "timepicker",
  "colors",
  "file",
  "textarea",
];

/** The datepicker draws *today*, so an unpinned clock re-records every calendar image daily. */
const PINNED = new Date("2026-06-15T09:00:00Z");

mkdirSync(TARGET, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
await page.clock.setFixedTime(PINNED);
await page.goto(ORIGIN, { waitUntil: "networkidle" });
await page.locator(".mdy-renderer--text").first().waitFor({ state: "visible" });

await page.evaluate(
  async ([theme, palette, seed]) => {
    const link = document.getElementById("modyra-theme");
    if (!(link instanceof HTMLLinkElement)) throw new Error("the demo has no #modyra-theme to swap");
    const href = `./themes/${theme}.css`;
    if (link.getAttribute("href") !== href) {
      await new Promise((done) => {
        link.addEventListener("load", () => done(), { once: true });
        link.addEventListener("error", () => done(), { once: true });
        link.setAttribute("href", href);
      });
    }
    const root = document.documentElement;
    // A compiled theme and a live palette are two engines for one set of tokens; leaving the
    // compiled one attached would seed the page twice and neither answer would be this one.
    root.removeAttribute("data-mdy-theme");
    const compiled = document.getElementById("modyra-compiled-theme");
    if (compiled instanceof HTMLLinkElement) compiled.disabled = true;
    root.dataset.mdyPalette = palette;
    root.style.setProperty("--mdy-sys-color-primary", seed);
    // Text metrics decide most of these pixels, so a shot taken mid-load is a shot of another font.
    await document.fonts.ready;
  },
  [THEME, PALETTE, SEED],
);
await page.waitForTimeout(300);

let shot = 0;
const missing = [];
for (const kind of WIDGETS) {
  const widget = page.locator(`.mdy-renderer--${kind}`).first();
  if ((await widget.count()) === 0) {
    missing.push(kind);
    continue;
  }
  await widget.scrollIntoViewIfNeeded();
  await widget.screenshot({ path: join(TARGET, `${kind}.png`) });
  shot += 1;
}

await page.screenshot({ path: join(TARGET, "page.png"), fullPage: true });
await browser.close();

if (missing.length > 0) {
  console.log(`Not rendered by the demo, so not captured: ${missing.join(", ")}`);
}
console.log(`Captured ${shot} widget images plus the full page, into docs/assets/widgets/.`);
console.log(`Theme ${THEME}, palette ${PALETTE}, seed ${SEED}.`);
