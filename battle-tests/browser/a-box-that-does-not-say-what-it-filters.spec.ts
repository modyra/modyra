/**
 * A search box with a placeholder for a name.
 *
 * `projectMultiselectFieldA11y` declares three things about the box inside the option popup, and each
 * is something a reader needs rather than something a designer chose:
 *
 *   aria-label="Filter options"   what it is
 *   aria-controls=<group id>      what typing in it changes
 *   id                            so anything else can point at it
 *
 * One renderer carries all three. The other carries a `placeholder` and nothing else, and a
 * placeholder is the last resort of the accessible-name computation — it names the box until the
 * moment a user types into it, and then the name is gone. The box also says nothing about what it
 * filters, so a reader who lands on it has no way to know the list behind it is what changes.
 *
 * Every route to a name is checked, not just the declared one: `aria-label`, `aria-labelledby`, an
 * associated `<label>`, `title`. A renderer that names it another way passes. That check has already
 * dismissed two findings on neighbouring parts of this same widget family, so it is the one that
 * makes the failure mean something.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { projectMultiselectFieldA11y } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

const STATE = {
  label: "Tags", open: true,
  options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
  selectedValues: [], selectedKeys: new Set(), counts: new Map(), query: "",
  activeIndex: -1, disabled: false, readonly: false, required: false, invalid: false, touched: false, dirty: false,
};

const SEARCH = ".mdy-multiselect-overlay__input";

for (const host of HOSTS) {
  test(`the filter box says what it is and what it changes, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const declared = (projectMultiselectFieldA11y(STATE as never, [], { widgetId: "w" }) as never as
      Record<string, { attributes?: Record<string, unknown> }>).search.attributes ?? {};

    // The premise, read from the contract: this part is declared with a name and a target.
    expect(
      [typeof declared["aria-label"], typeof declared["aria-controls"]],
      "the projection no longer declares a name and a target for the filter box",
    ).toEqual(["string", "string"]);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(id: string, fields: unknown[]): unknown }>)[api]
        .mountFields("m", [{
          // The filter box exists because this field asked for it. It is not drawn otherwise, and a
          // spec that omitted the flag would be measuring a control that was never offered one —
          // which is what this file did while every multiselect got a box whether it asked or not.
          name: "x", kind: "multiselect", label: "Tags", searchable: true,
          options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
        }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    const openers = page.locator('[data-form="m"] button, [data-form="m"] [role="combobox"]');
    for (let index = 0; index < Math.min(await openers.count(), 4); index += 1) {
      await openers.nth(index).click({ timeout: 2500 }).catch(() => {
        // One candidate of several, and most are not the opener. Which one was is decided by the
        // check after this loop, so a press that does not land is a step of the sweep, not a fault.
      });
      await page.waitForTimeout(200);
      if (await page.locator(SEARCH).count() > 0) break;
    }

    const seen = await page.evaluate((selector) => {
      const box = document.querySelector(selector) as HTMLInputElement | null;
      if (box === null) return null;
      const labelledBy = box.getAttribute("aria-labelledby");
      return {
        // Every route to a name there is, so a renderer that names it another way passes.
        name: box.getAttribute("aria-label")
          ?? (labelledBy === null ? null : labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" ").trim() || null)
          ?? (box.labels && box.labels.length > 0 ? Array.from(box.labels).map((each) => each.textContent?.trim()).join(" ") : null)
          ?? box.getAttribute("title"),
        placeholder: box.getAttribute("placeholder"),
        controls: box.getAttribute("aria-controls"),
      };
    }, SEARCH);

    expect(seen, "the option popup has no filter box, so nothing below is a measurement").not.toBeNull();

    expect(
      seen?.name,
      `the filter box is named only by its placeholder ${JSON.stringify(seen?.placeholder)}, which stops naming it the moment somebody types`,
    ).not.toBeNull();

    expect(
      seen?.controls,
      "the filter box does not say which list it filters",
    ).not.toBeNull();
  });
}
