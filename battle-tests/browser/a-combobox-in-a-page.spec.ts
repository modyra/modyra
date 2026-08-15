/**
 * The keyboard rules, obeyed by a control that is actually on a page.
 *
 * `selectKeyboardAction` is pinned headlessly as a pure function: which key does what, in which
 * state. What that cannot say is whether the rendered combobox asks it, and whether the browser
 * ends up where the answer says. A renderer that computed the right action and swallowed the event
 * would pass every headless check and still trap a user.
 *
 * The Plain select renders as `button[role="combobox"]` over a listbox, so the rules that matter are
 * the ones a person meets with a keyboard alone: an arrow opens the list, Escape closes it and gives
 * focus back, and **Tab leaves** — the one whose failure is not a bug but a trap.
 *
 * `aria-activedescendant` is here too because it is the half a screen reader reads: a combobox
 * pointing at an id that is not in the document announces nothing while looking correct in every
 * other way.
 */

import { expect, test } from "@playwright/test";

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

const combobox = (page: import("@playwright/test").Page) =>
  page.locator('[data-form="main"] [role="combobox"]').first();

const state = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const button = document.querySelector('[data-form="main"] [role="combobox"]') as HTMLElement;
    const active = button.getAttribute("aria-activedescendant");
    return {
      expanded: button.getAttribute("aria-expanded"),
      activedescendant: active,
      activeResolves: active === null ? null : document.getElementById(active) !== null,
      focusIsTheCombobox: document.activeElement === button,
      focusTag: document.activeElement?.tagName.toLowerCase() ?? null,
    };
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
  await page.evaluate(() => (window as never as { battle: { mount(id: string): void } }).battle.mount("main"));
  await settled(page);
});

test("an arrow opens the list rather than moving what nobody can see", async ({ page }) => {
  await combobox(page).focus();
  expect((await state(page)).expanded).toBe("false");

  await page.keyboard.press("ArrowDown");
  await settled(page);
  expect((await state(page)).expanded).toBe("true");
});

test("Escape closes the list and hands focus back to the control", async ({ page }) => {
  await combobox(page).focus();
  await page.keyboard.press("ArrowDown");
  await settled(page);

  await page.keyboard.press("Escape");
  await settled(page);

  const after = await state(page);
  expect(after.expanded).toBe("false");
  expect(after.focusIsTheCombobox).toBe(true);
});

test("Tab leaves the control instead of being kept by it", async ({ page }) => {
  await combobox(page).focus();
  await page.keyboard.press("ArrowDown");
  await settled(page);
  expect((await state(page)).expanded).toBe("true");

  await page.keyboard.press("Tab");
  await settled(page);

  const after = await state(page);
  // Both halves: the list is not left hanging over a form the user has moved out of, and the user
  // has actually moved. A control that closed and kept focus is the same trap more politely.
  expect(after.expanded).toBe("false");
  expect(after.focusIsTheCombobox).toBe(false);
});

test("what the combobox points a screen reader at is in the document", async ({ page }) => {
  await combobox(page).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await settled(page);

  const open = await state(page);
  // Either it names an option or it names nothing; what it may not do is name an element that is
  // not there, which reads as correct markup and announces nothing.
  expect(open.activeResolves === null || open.activeResolves === true).toBe(true);

  await page.keyboard.press("Escape");
  await settled(page);
  const closed = await state(page);
  expect(closed.activeResolves === null || closed.activeResolves === true).toBe(true);
});
