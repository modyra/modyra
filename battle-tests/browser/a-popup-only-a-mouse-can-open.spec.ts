import { expect, test } from "@playwright/test";

import { panelsHome } from "./bench";

/**
 * The popups a keyboard can open, and the ones it cannot.
 *
 * A control that declares `role="combobox"` with `aria-haspopup` and `aria-controls` has told
 * assistive technology that it owns a popup and that the keyboard opens it — that is what the role
 * means, and it is why a screen reader announces "collapsed". Six widgets here declare a popup. The
 * select opens on Down Arrow and the multiselect on any of four keys; the datepicker and the
 * timepicker open on a mouse click and on none of eight keys.
 *
 * The bound matters and is asserted: a value can still be typed into both, so neither control is
 * unusable from a keyboard. What cannot be reached is the popup itself — the calendar a person
 * browses when they do not already know the date, and the clock. And the typed path is the one
 * finding 34 is about: the format that works is undiscoverable, because what does not parse is erased
 * without a word.
 *
 * The keys tried are the ones the pattern and the platforms use: both arrows, Alt+Down, Enter, Space
 * and F4. A control that opened on any of them would pass.
 *
 * Claims under attack: A11Y-002, A11Y-004.
 */

const KEYS = ["ArrowDown", "ArrowUp", "Alt+ArrowDown", "Enter", " ", "F4"];

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** Mount one field of `kind` and answer whether `key` opened its popup. */
async function opensWith(page: import("@playwright/test").Page, kind: string, key: string, id: string) {
  const field: Record<string, unknown> = { name: "f", kind, label: "F" };
  if (/select/.test(kind)) field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  // The shape with a popup, said rather than defaulted: a select that names none is the platform's
  // own chooser, whose list the browser draws and no attribute in the page describes. There is no
  // popup of the library's to open, so this file has nothing to ask it.
  if (kind === "select") field.searchable = true;

  await page.evaluate(
    ({ mountId, declared }) => window.battle.mountFields(mountId, [declared] as never),
    { mountId: id, declared: field },
  );
  await settled(page);

  const trigger = page.locator(`[data-form="${id}"] [aria-haspopup]`).first();
  await trigger.focus();
  await page.keyboard.press(key);
  await page.waitForTimeout(110);

  return page.evaluate(
    (selector) => document.querySelector(`${selector} [aria-haspopup]`)!.getAttribute("aria-expanded") === "true",
    `[data-form="${id}"]`,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a mouse opens every popup, which is what makes the keyboard the question", async ({ page }) => {
  // The control. A popup that no pointer opens either is broken in a different and larger way, and
  // the assertions below would be about that instead.
  for (const [index, kind] of ["select", "multiselect", "datepicker", "timepicker"].entries()) {
    const id = `mouse-${index}`;
    const field: Record<string, unknown> = { name: "f", kind, label: "F" };
    if (/select/.test(kind)) field.options = [{ value: "a", label: "A" }];
    if (kind === "select") field.searchable = true;
    await page.evaluate(
      ({ mountId, declared }) => window.battle.mountFields(mountId, [declared] as never),
      { mountId: id, declared: field },
    );
    await settled(page);
    // The panel the previous kind opened is still standing where a renderer draws it over the page,
    // and the click would land on it instead of on this field's trigger.
    await panelsHome(page);

    await page.locator(`[data-form="${id}"] [aria-haspopup]`).first().click();
    await page.waitForTimeout(120);
    const expanded = await page.evaluate(
      (selector) => document.querySelector(`${selector} [aria-haspopup]`)!.getAttribute("aria-expanded"),
      `[data-form="${id}"]`,
    );
    expect(expanded, `${kind} did not open on a click`).toBe("true");
  }
});

test("every control that declares a popup opens it from the keyboard", async ({ page }) => {
  const closed: Array<{ kind: string; triedKeys: string[] }> = [];

  for (const kind of ["select", "multiselect", "datepicker", "timepicker"]) {
    const opened: string[] = [];
    for (const [index, key] of KEYS.entries()) {
      if (await opensWith(page, kind, key, `kb-${kind}-${index}`)) opened.push(key);
    }
    if (opened.length === 0) closed.push({ kind, triedKeys: KEYS });
  }

  expect(closed, JSON.stringify(closed, null, 1)).toEqual([]);
});

test("a value can still be typed into the pickers whose popup will not open", async ({ page }) => {
  // What bounds the finding above. Neither control is unusable from a keyboard; what is unreachable
  // is the popup. This is green, and it is the reason the one above is not filed as "cannot be used".
  for (const [index, [kind, text, expected]] of ([
    ["datepicker", "03/04/2026", "2026-03-04"],
    // Typed in the notation the control shows, held in the one the value contract names.
    ["timepicker", "2:30 PM", "14:30"],
  ] as const).entries()) {
    const id = `typed-${index}`;
    // The timepicker row types twelve-hour notation, so it asks for the twelve-hour clock. 24-hour is
    // the default (ADR 0116) and a picker on it correctly refuses `2:30 PM` — this row was asserting
    // the answer of a premise that record reversed, and `format` is the slot 0116 left for saying so.
    await page.evaluate(
      ({ mountId, k }) => window.battle.mountFields(
        mountId,
        [k === "timepicker" ? { name: "f", kind: k, label: "F", format: "12h" } : { name: "f", kind: k, label: "F" }] as never,
      ),
      { mountId: id, k: kind },
    );
    await settled(page);

    const control = page.locator(`[data-form="${id}"] [aria-haspopup]`).first();
    await control.focus();
    await page.keyboard.type(text);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);

    const held = await page.evaluate((mountId) => (window.battle.valueOf(mountId) as Record<string, unknown>).f, id);
    expect(held, `${kind} did not take ${text} from the keyboard`).toBe(expected);
  }
});
