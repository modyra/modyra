// Records the 60-second demo video following .modyra/go-to-market-en/demo/script-60s.md.
//
// Segments, recorded with Playwright at 1280x720:
//   1. plain showcase page (serve-example.mjs plain 4307, /showcase.html) — typing writes the
//      live state panel, the conditional section answers the account select, themes, dark mode,
//      submit
//   2. Studio (studio:dev on 4322, or the hosted build as fallback) — palette, inspector,
//      validation, preview, export
//   3. title and end cards — brand-gradient HTML rendered and screenshotted, then looped
//
// Assembly: ffmpeg concat → site/public/demo/modyra-demo-60s.mp4
// Usage: node scripts/record-demo-video.mjs [--plain-only] [--keep-tmp]
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TMP = join(ROOT, ".tmp", "demo-video");
const OUT_DIR = join(ROOT, "site", "public", "demo");
const OUT = join(OUT_DIR, "modyra-demo-60s.mp4");
const PLAIN_ONLY = process.argv.includes("--plain-only");
const KEEP_TMP = process.argv.includes("--keep-tmp");
const SIZE = { width: 1280, height: 720 };

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(cmd, args, port) {
  const proc = spawn(cmd, args, { cwd: ROOT, stdio: "ignore" });
  return {
    proc,
    async ready(tries = 120) {
      for (let i = 0; i < tries; i++) {
        try {
          const res = await fetch(`http://localhost:${port}/`);
          if (res.ok) return;
        } catch {}
        await sleep(500);
      }
      throw new Error(`server on :${port} never came up`);
    },
    stop() { proc.kill("SIGTERM"); },
  };
}

async function recordSegment(name, fn) {
  const browser = await chromium.launch();
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir, size: SIZE },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await fn(page);
  await context.close();
  await browser.close();
  const videos = readdirSync(dir).filter((f) => f.endsWith(".webm"));
  if (videos.length !== 1) throw new Error(`segment ${name}: expected 1 video, got ${videos.length}`);
  const out = join(TMP, `${name}.webm`);
  copyFileSync(join(dir, videos[0]), out);
  return out;
}

async function beatShowcase(page) {
  await page.goto("http://localhost:4307/showcase.html", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-showcase-form] .mdy-renderer", { timeout: 15000 });
  await sleep(2000);

  // Beat 1: typing writes the live state panel on the right.
  const name = page.locator("[data-field-host='name'] input").first();
  await name.click();
  await name.pressSequentially("Ada Lovelace", { delay: 70 });
  await sleep(800);
  const email = page.locator("[data-field-host='email'] input").first();
  await email.click();
  await email.pressSequentially("ada@modyra.dev", { delay: 70 });
  await sleep(1200);

  // Beat 2: the conditional block answers the account select — Personal hides it, Company
  // brings it back and the state panel gains the group.
  const account = page.locator("[data-field-host='account'] [role='combobox'], [data-field-host='account'] button").first();
  if (await account.count()) {
    await account.click();
    await sleep(700);
    const company = page.getByRole("option", { name: /^company$/i }).first();
    if (await company.count()) { await company.click(); await sleep(1500); }
  }
  const conditional = page.locator("[data-showcase-conditional]");
  await conditional.scrollIntoViewIfNeeded();
  await sleep(700);
  const companyName = page.locator("[data-field-host='company.name'] input").first();
  if (await companyName.count()) {
    await companyName.click();
    await companyName.pressSequentially("Acme S.r.l.", { delay: 70 });
    await sleep(1200);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(600);

  // Beat 3: the same contract under three design languages.
  for (const theme of ["material", "ios", "modern"]) {
    const btn = page.locator(`[data-showcase-themes] button[data-theme='${theme}']`);
    if (await btn.count()) { await btn.click(); await sleep(2000); }
  }

  // Beat 4: dark mode, then back to light for the closing beat.
  const dark = page.locator("[data-showcase-mode] button[data-mode='dark']");
  if (await dark.count()) { await dark.click(); await sleep(2200); }
  const light = page.locator("[data-showcase-mode] button[data-mode='light']");
  if (await light.count()) { await light.click(); await sleep(1000); }

  // Beat 5: terms, then submit — the confirmation line appears. The checkbox input is the
  // visually-hidden control; its label is the clickable surface.
  const terms = page.locator("[data-field-host='terms'] label").first();
  if (await terms.count()) { await terms.click(); await sleep(800); }
  const submit = page.locator("[data-showcase-submit]").first();
  if (await submit.count()) {
    await submit.scrollIntoViewIfNeeded();
    await sleep(500);
    await submit.click();
    await sleep(2000);
  }
}

async function beatStudio(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await sleep(2500);

  // Beat 5 (0:38-0:46): the dock is collapsed at this viewport, so fields are added through the
  // "Add field" palette: ⌘K opens it, Enter takes the highlighted kind (Text is first).
  try {
    await page.keyboard.press("Meta+k");
    await sleep(900);
    const textOption = page.locator("[role=dialog] button, [role=listbox] button").filter({ hasText: /^Text/ }).first();
    if (await textOption.count()) await textOption.click({ timeout: 4000 });
    else await page.keyboard.press("Enter");
    await sleep(1800);
  } catch { /* a palette that never opens still leaves the canvas worth showing */ }

  // The inspector's Label field, if the palette added a field.
  try {
    const labelInput = page.locator("label", { hasText: /^Label$/ }).locator("..").locator("input").first();
    if (await labelInput.isVisible()) {
      await labelInput.click();
      await labelInput.fill("");
      await labelInput.pressSequentially("Email", { delay: 110 });
      await sleep(1200);
    }
  } catch { /* inspector layout is free to change; the beat is optional */ }

  // Beat 6 (0:46-0:55): Export tab — pick the contract target and generate.
  try {
    const exportTab = page.locator("[role=tab]", { hasText: /export/i }).first();
    await exportTab.click({ timeout: 6000 });
    const generate = page.locator("button", { hasText: /^generate$/i }).first();
    await generate.waitFor({ state: "visible", timeout: 8000 });
    await sleep(1200);
    const contractTarget = page.locator("button", { hasText: /contract/i }).first();
    if (await contractTarget.isVisible()) { await contractTarget.click(); await sleep(900); }
    await generate.click();
    await sleep(2800);
  } catch (e) {
    console.warn("studio export beat failed:", e.message.split("\n")[0]);
  }
}

function cardHtml(title, subtitle) {
  return `<!doctype html><html><body style="margin:0;width:${SIZE.width}px;height:${SIZE.height}px;
    display:flex;flex-direction:column;justify-content:center;align-items:center;gap:24px;
    background:linear-gradient(135deg,#0E0F16 0%,#1a1b2e 100%);color:#F8FAFC;
    font-family:-apple-system,'SF Pro Display',sans-serif;text-align:center;">
    <div style="font-size:52px;font-weight:800;letter-spacing:-0.02em;max-width:900px;line-height:1.15;
      color:#FF6577;">${title}</div>
    <div style="font-size:22px;color:#94A3B8;max-width:760px;line-height:1.5;">${subtitle}</div>
  </body></html>`;
}

async function shootCard(name, title, subtitle) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 2 });
  await page.setContent(cardHtml(title, subtitle));
  await sleep(400);
  const out = join(TMP, `${name}.png`);
  await page.screenshot({ path: out });
  await browser.close();
  return out;
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", ...args], { stdio: "inherit" });
}

function loopCard(png, seconds, out) {
  ffmpeg([
    "-loop", "1", "-t", String(seconds), "-i", png,
    "-vf", `scale=${SIZE.width}:${SIZE.height},fps=30,format=yuv420p`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", out,
  ]);
}

function toMp4(webm, out) {
  ffmpeg(["-i", webm, "-vf", `scale=${SIZE.width}:${SIZE.height},fps=30,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-an", out]);
}

async function main() {
  const plain = serve("node", ["scripts/serve-example.mjs", "plain", "4307"], 4307);
  let studio = null;
  await plain.ready();
  if (!PLAIN_ONLY) {
    studio = serve("node", ["apps/studio/server.mjs"], 4322);
    try { await studio.ready(60); } catch { console.warn("studio local not up — will try hosted"); studio = null; }
  }

  const parts = [];
  const titleCard = await shootCard("card-title",
    "One form contract. Every framework. Any backend.",
    "The typed contract between your backend and every frontend form.");
  loopCard(titleCard, 4, join(TMP, "part-00-title.mp4"));
  parts.push(join(TMP, "part-00-title.mp4"));

  const showcaseWebm = await recordSegment("showcase", beatShowcase);
  toMp4(showcaseWebm, join(TMP, "part-01-showcase.mp4"));
  parts.push(join(TMP, "part-01-showcase.mp4"));

  if (!PLAIN_ONLY) {
    const studioUrl = studio ? "http://localhost:4322/" : "https://modyra.github.io/modyra/studio/app/";
    try {
      const studioWebm = await recordSegment("studio", (page) => beatStudio(page, studioUrl));
      toMp4(studioWebm, join(TMP, "part-02-studio.mp4"));
      parts.push(join(TMP, "part-02-studio.mp4"));
    } catch (e) {
      console.warn("studio segment failed, skipping:", e.message);
    }
  }

  const endCard = await shootCard("card-end",
    "Your backend defines the business form. Your frontend owns the experience.",
    "modyra.github.io/modyra  ·  github.com/modyra/modyra");
  loopCard(endCard, 5, join(TMP, "part-99-end.mp4"));
  parts.push(join(TMP, "part-99-end.mp4"));

  const listFile = join(TMP, "concat.txt");
  writeFileSync(listFile, parts.map((p) => `file '${p}'`).join("\n"));
  ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", OUT]);

  plain.stop();
  if (studio) studio.stop();

  const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries",
    "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", OUT]).toString().trim();
  console.log(`\nvideo: ${OUT} (${Math.round(probe)}s)`);
  if (!KEEP_TMP) console.log("intermediates kept in", TMP, "(delete when happy)");
}

main().catch((e) => { console.error(e); process.exit(1); });
