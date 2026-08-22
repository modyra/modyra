/**
 * Renders the homepage social card (brand/05-social/og-home.png) from the
 * canonical brand assets: horizontal logo, Satoshi, night background.
 * Run: npm run brand:og-home
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoSvg = readFileSync(join(root, "brand/01-logo/svg/modyra-logo-horizontal.svg"), "utf8");
const font = (name) => pathToFileURL(join(root, "brand/03-typography/fonts", name)).href;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Satoshi; src: url("${font("Satoshi-Bold.woff2")}"); font-weight: 700; }
  @font-face { font-family: Satoshi; src: url("${font("Satoshi-Medium.woff2")}"); font-weight: 500; }
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; background: #0E0F16;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: Satoshi, system-ui, sans-serif; overflow: hidden;
  }
  .logo svg { width: 400px; height: auto; display: block; }
  h1 {
    margin: 54px 0 0; max-width: 980px; text-align: center;
    color: #F8FAFC; font-weight: 700; font-size: 54px; line-height: 1.15; letter-spacing: -0.02em;
  }
  h1 em { font-style: normal; color: #FF6577; }
  p { margin: 24px 0 0; color: #8B90B8; font-weight: 500; font-size: 23px; }
</style></head><body>
  <div class="logo">${logoSvg}</div>
  <h1>One form <em>contract</em>. Every framework. Any backend.</h1>
  <p>State, validation, drafts and submission — as data, not component code.</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
const output = join(root, "brand/05-social/og-home.png");
await page.screenshot({ path: output });
await browser.close();
console.log("[generate-og-home] written", output);
