import { expect, test } from "@playwright/test";

/**
 * A city called New York, and the option nobody hears.
 *
 * `assertUsableWidgetId` refuses a widget id containing whitespace, and its message says exactly why:
 *
 *   Whitespace splits every ARIA reference built from it into several, each resolving to nothing, so
 *   the control ends up with no accessible name.
 *
 * That guard stands over the widget id. An option's id is built from the option's **value**, and
 * nothing stands there. `{ value: "New York" }` is ordinary data — a city, a plan name, a country —
 * and it produces `id="city__option__New York"`.
 *
 * `aria-activedescendant` is a space-separated list of ids. Pointed at that one it reads as two
 * references, `city__option__New` and `York`, and neither is anything. So while the first option of
 * the list is active — which is how the list opens — the combobox is pointing at nothing, and a
 * screen reader announces nothing. Move to `Paris` and it works.
 *
 * `getElementById` is not the check: it accepts a string with a space in it and finds the element, so
 * a page that asked it would report everything fine. The split is the check, because the split is what
 * assistive technology does.
 *
 * Either resolution closes it: refuse an option value that cannot be part of an id, the way a field
 * name that cannot be is refused, or build an option id that does not embed the value.
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** What the combobox is pointing at, read the way assistive technology reads it. */
const pointing = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-form="city"] [role="combobox"]')!;
    const active = box.getAttribute("aria-activedescendant");
    return {
      active,
      // An IDREF list is space-separated. Every part has to name something.
      parts: active === null ? [] : active.split(/\s+/).map((id) => ({ id, resolves: document.getElementById(id) !== null })),
      dangling: window.battle.danglingReferences(),
    };
  });

async function openCityPicker(page: import("@playwright/test").Page, options: Array<Record<string, string>>) {
  await page.evaluate(
    (opts) => window.battle.mountFields("city", [{ name: "city", kind: "select", label: "City", options: opts }] as never),
    options,
  );
  await settled(page);
  await page.locator('[data-form="city"] [role="combobox"]').click();
  await settled(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("an option whose value has no space is pointed at properly", async ({ page }) => {
  // The control: the same widget, the same navigation, a value with nothing unusual in it.
  await openCityPicker(page, [{ value: "Paris", label: "Paris" }, { value: "Lyon", label: "Lyon" }]);

  const state = await pointing(page);
  expect(state.parts.length).toBe(1);
  expect(state.parts.every((part) => part.resolves)).toBe(true);
  expect(state.dangling).toEqual([]);
});

test("an option whose value has a space is pointed at properly too", async ({ page }) => {
  await openCityPicker(page, [{ value: "New York", label: "New York" }, { value: "Paris", label: "Paris" }]);

  const opened = await pointing(page);

  // The premise: the list opens with the first option active, which is the one carrying the space.
  expect(opened.active, "the list did not open on the option this battle is about").toContain("New York");

  // Every part of the reference names something. One reference, one element.
  expect(opened.parts, JSON.stringify(opened)).toEqual([
    { id: "city__option__New York", resolves: true },
  ]);
  expect(opened.dangling, "the page's own check reports the broken halves").toEqual([]);
});

test("moving to an option without a space fixes it, which is what makes the value the cause", async ({ page }) => {
  // Green, and the reason the failure above is attributed to the value rather than to the widget:
  // the same list, the same keys, one step down, and everything resolves.
  await openCityPicker(page, [{ value: "New York", label: "New York" }, { value: "Paris", label: "Paris" }]);
  await page.keyboard.press("ArrowDown");
  await settled(page);

  const moved = await pointing(page);
  expect(moved.active).toBe("city__option__Paris");
  expect(moved.parts).toEqual([{ id: "city__option__Paris", resolves: true }]);
  expect(moved.dangling).toEqual([]);
});
