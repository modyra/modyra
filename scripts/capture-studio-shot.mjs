/**
 * Captures the Studio canvas shot used by the Studio landing page
 * (site/src/pages/studio/index.astro): the checkout fixture from
 * packages/studio-model/test/fixtures/checkout.fixture.mjs seeded into the session store, with a
 * field selected so the inspector shows its validators.
 * Run: npm run docs:studio-shot
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCheckoutProject } from "../packages/studio-model/test/fixtures/checkout.fixture.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4322; // apps/studio/server.mjs listens here by design
const OUT = join(root, "site/public/shots/studio-checkout.png");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const project = createCheckoutProject();
// The fixture names fields but does not label them; a canvas of "Untitled field" is not the
// product. Label from the name.
const label = (name) => ({ zip: "ZIP code", sku: "SKU", qty: "Quantity" })[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
const walk = (node) => {
  if (node.node === "field" && !node.label) node.label = label(node.name);
  (node.children ?? []).forEach(walk);
};
walk(project.schema);

const up = async () => {
  try {
    return (await fetch(`http://localhost:${PORT}/`)).ok;
  } catch {
    return false;
  }
};

// Reuse a Studio server if one is already listening; otherwise own one for the run.
let server = null;
if (!(await up())) {
  server = spawn("node", ["apps/studio/server.mjs"], { cwd: root, stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await sleep(500);
  if (!(await up())) throw new Error(`studio server on :${PORT} never came up`);
}

try {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  // Seed the session store the app reads on boot, then reload so it picks the project up.
  await page.evaluate(async (snapshot) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("modyra-studio", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("sessions")) req.result.createObjectStore("sessions");
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(snapshot, "last");
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, project);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  // Select a field so the inspector reads as the product, not as an empty root.
  await page.getByText("ZIP code", { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT });
  await browser.close();
  console.log("[capture-studio-shot] written", OUT);
} finally {
  server?.kill("SIGTERM");
}
