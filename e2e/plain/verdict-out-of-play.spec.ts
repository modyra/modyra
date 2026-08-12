import { expect, test } from "@playwright/test";

/**
 * Out of play, no verdict — in a real browser, over the whole catalogue at once.
 *
 * The unit suites assert the contract and this renderer's DOM in jsdom. What is left is the page: a
 * theme's own rules paint the failing state, and a stylesheet can put a colour on a field the
 * renderer stopped marking. This drives the demo's state toolbar and reads the page back.
 */
const TOOLBAR = "[data-states-toolbar]";
const PANEL = "[data-states]";
const FAILING = `${PANEL} .mdy-input-wrapper--error, ${PANEL} .mdy-label--has-error, ${PANEL} [aria-invalid="true"]`;

async function toggle(page: import("@playwright/test").Page, label: string) {
  await page.locator(`${TOOLBAR} label`, { hasText: label }).locator("input").click();
}

async function readout(page: import("@playwright/test").Page) {
  return JSON.parse((await page.locator("[data-states-state]").textContent()) ?? "{}");
}

test("the catalogue paints its verdict while the form is asking", async ({ page }) => {
  await page.goto("/");
  await toggle(page, "Touched");
  await expect(page.locator(FAILING).first()).toBeVisible();
  expect((await readout(page)).partsPaintedAsFailing).toBeGreaterThan(0);
});

test("a section the form stops asking about paints nothing, and loses nothing", async ({ page }) => {
  await page.goto("/");
  await toggle(page, "Touched");
  const held = (await readout(page)).errorsHeld;
  expect(held).toBeGreaterThan(0);

  await toggle(page, "Out of play");
  await expect(page.locator(FAILING)).toHaveCount(0);
  const out = await readout(page);
  expect(out.partsPaintedAsFailing).toBe(0);
  expect(out.errorsHeld).toBe(held);
  expect(out.formValid).toBe(true);
  // The toggle itself is still submitted; the section it closed is not.
  expect(out.submitted).not.toContain("all");

  // Back in play: the verdict returns because it was never withdrawn, only unshown.
  await toggle(page, "Out of play");
  await expect(page.locator(FAILING).first()).toBeVisible();
  expect((await readout(page)).errorsHeld).toBe(held);
});

test("a disabled field shows no verdict either", async ({ page }) => {
  await page.goto("/");
  await toggle(page, "Touched");
  await expect(page.locator(FAILING).first()).toBeVisible();
  await toggle(page, "Disabled");
  await expect(page.locator(FAILING)).toHaveCount(0);
});

test("read-only blocks the write and not the reach", async ({ page }) => {
  await page.goto("/");
  await toggle(page, "Read-only");
  const control = page.locator(`${PANEL} input[id="all.text"]`);
  await expect(control).toHaveAttribute("readonly", "");
  await control.focus();
  await expect(control).toBeFocused();
});
