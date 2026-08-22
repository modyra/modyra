// Records the 60-second demo video following .modyra/go-to-market-en/demo/script-60s.md.
//
// Segments, recorded with Playwright at 1280x720:
//   1. plain example (serve-example.mjs plain 4307) — catalog, themes, modes, conditional
//      section, keyed rows
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

async function beatPlain(page) {
  await page.goto("http://localhost:4307/", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-form] .mdy-renderer", { timeout: 15000 });

  // Beat 1 (0:00-0:08): slow scroll through the catalog.
  await sleep(1500);
  await page.mouse.move(640, 400);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 260);
    await sleep(650);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(800);

  // Beat 2 (0:08-0:20): theme bar, then dark mode.
  const themes = page.locator("[data-themes] button");
  const themeNames = ["material", "ios", "modern"];
  for (const name of themeNames) {
    const btn = themes.filter({ hasText: name }).first();
    if (await btn.count()) {
      await btn.click();
      await sleep(1800);
    }
  }
  // The mode bar is hidden under a live palette; the compiled "salience" palette reveals it.
  const salience = page.locator("[data-palette] button[data-palette='salience']");
  if (await salience.count()) { await salience.click(); await sleep(1200); }
  const dark = page.locator("[data-color-mode] button").filter({ hasText: /dark/i }).first();
  if (await dark.count()) {
    await dark.click();
    await sleep(1800);
    const light = page.locator("[data-color-mode] button").filter({ hasText: /light/i }).first();
    if (await light.count()) { await light.click(); await sleep(1200); }
  }

  // Beat 3 (0:20-0:30): conditional section — account kind to Company, type and clear.
  await page.locator("[data-conditional-section]").scrollIntoViewIfNeeded();
  await sleep(900);
  const conditional = page.locator("[data-conditional]");
  const trigger = conditional.locator("button, [role='combobox']").first();
  if (await trigger.count()) {
    await trigger.click();
    await sleep(700);
    const company = page.getByRole("option", { name: /company/i }).first();
    if (await company.count()) { await company.click(); await sleep(1200); }
  }
  const companyName = conditional.locator("input[type='text']").first();
  if (await companyName.count()) {
    await companyName.click();
    await companyName.pressSequentially("Acme", { delay: 140 });
    await sleep(900);
    await companyName.fill("");
    await page.locator("[data-conditional-state]").click(); // blur to trigger validation
    await sleep(1500);
    await companyName.fill("Acme");
    await sleep(900);
  }

  // Beat 4 (0:30-0:38): keyed rows — add, rename, remove.
  await page.locator("[data-rows-section]").first().scrollIntoViewIfNeeded();
  await sleep(900);
  const rowsSection = page.locator("[data-rows-section]").first();
  const addBtn = rowsSection.locator("button").filter({ hasText: /add|new|insert|\+/i }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await sleep(1500);
  }
  const rowButtons = rowsSection.locator("button").filter({ hasText: /remove|delete|×/i });
  if (await rowButtons.count()) {
    await rowButtons.last().click();
    await sleep(1500);
  }
}

async function beatStudio(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await sleep(2500);

  // Beat 5 (0:38-0:46): add a Text field from the palette, label it, add Required.
  const paletteText = page.getByRole("button", { name: /^text$/i }).first();
  if (await paletteText.count()) {
    await paletteText.click();
    await sleep(1500);
  } else {
    const paletteItem = page.getByText(/^Text$/).first();
    if (await paletteItem.count()) { await paletteItem.click(); await sleep(1500); }
  }
  const labelInput = page.getByLabel(/label/i).first();
  if (await labelInput.count()) {
    await labelInput.click();
    await labelInput.fill("");
    await labelInput.pressSequentially("Email", { delay: 120 });
    await sleep(1200);
  }
  const addValidator = page.locator("[data-add-validator]").first();
  if (await addValidator.count()) {
    await addValidator.selectOption({ label: /required/i }).catch(() => addValidator.selectOption({ index: 1 }));
    await sleep(1500);
  }

  // Beat 6 (0:46-0:55): Export tab, generate contract, then a code target.
  const exportTab = page.getByRole("tab", { name: /export/i }).first();
  const exportByText = page.getByText(/^Export$/).first();
  if (await exportTab.count()) { await exportTab.click(); }
  else if (await exportByText.count()) { await exportByText.click(); }
  await sleep(1500);
  const generate = page.getByRole("button", { name: /generate/i }).first();
  if (await generate.count()) {
    await generate.click();
    await sleep(2500);
  }
}

function cardHtml(title, subtitle) {
  return `<!doctype html><html><body style="margin:0;width:${SIZE.width}px;height:${SIZE.height}px;
    display:flex;flex-direction:column;justify-content:center;align-items:center;gap:24px;
    background:linear-gradient(135deg,#0E0F16 0%,#1a1b2e 100%);color:#F8FAFC;
    font-family:-apple-system,'SF Pro Display',sans-serif;text-align:center;">
    <div style="font-size:52px;font-weight:800;letter-spacing:-0.02em;max-width:900px;line-height:1.15;
      background:linear-gradient(90deg,#6458EF,#A855F7,#FF6577);-webkit-background-clip:text;
      background-clip:text;color:transparent;">${title}</div>
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

  const plainWebm = await recordSegment("plain", beatPlain);
  toMp4(plainWebm, join(TMP, "part-01-plain.mp4"));
  parts.push(join(TMP, "part-01-plain.mp4"));

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
