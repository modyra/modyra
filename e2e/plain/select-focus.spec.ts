import { expect, test } from "@playwright/test";

/**
 * A select that closes must let go of the focus.
 *
 * `blur` closed with `restoreFocus: true`, so tabbing or clicking away from an open select pulled
 * focus back to its own trigger — the widget taking focus off whatever the user had just reached
 * for. The pointer path in the same renderer closed with `restoreFocus: false`, so the two
 * disagreed and which one ran decided where focus ended up.
 *
 * The arrow follows from the same event: it carries the `open` state and animates its rotation, and
 * a trigger regaining `:focus` a tick after the rotation starts is what made the close look like it
 * stuttered.
 */
const SELECT = ".mdy-renderer--select";
const TRIGGER = `${SELECT} .mdy-select__trigger`;

const active = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return `${el?.nodeName}.${(el?.className || "").toString().split(" ")[0]}`;
  });

test("Escape closes and keeps focus on the trigger — the deliberate case", async ({ page }) => {
  await page.goto("/");
  await page.locator(TRIGGER).first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "true");

  // The contrast that makes the rule legible: Escape has nowhere else to send focus, so it restores.
  await page.keyboard.press("Escape");
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "false");
  expect(await active(page)).toContain("mdy-select__trigger");
});

test("tabbing out of an OPEN select leaves focus where the user sent it", async ({ page }) => {
  await page.goto("/");
  await page.locator(TRIGGER).first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "true");

  // **This one does not discriminate**, measured: it passes with `blur` restoring focus too, because
  // the browser's own Tab has already moved focus by the time the restore command runs and the
  // restore loses the race. Kept because the behaviour is worth pinning, not because it catches the
  // defect — the click case below is what does that.
  await page.keyboard.press("Tab");
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "false");
  expect(await active(page)).not.toContain("mdy-select__trigger");
});

test("clicking another control while the list is open does not steal focus back", async ({ page }) => {
  await page.goto("/");
  await page.locator(TRIGGER).first().click();
  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "true");

  const other = page.locator(`button:not(${SELECT} button)`).first();
  await other.click();

  await expect(page.locator(TRIGGER).first()).toHaveAttribute("aria-expanded", "false");
  expect(await active(page)).not.toContain("mdy-select__trigger");
});
