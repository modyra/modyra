/**
 * What a closed multiselect puts on the page: the things a person picked, or the things they could.
 *
 * The decision was given directly — *"chips in the control, search on click"*, the overflow summarised
 * and the magnifier gone. Today all three renderers draw the **whole option list** inline in the closed
 * control, so a field's height is a function of how many things are on offer rather than of how many
 * were chosen:
 *
 *     three options, nothing chosen, popup closed
 *     plain 209px    lit 148px    angular 160px
 *
 * A form with four such fields is a page of options nobody has picked. And the cost is not only space:
 * everything offered is in the tab order, read out by a screen reader, and clickable, before anybody
 * has opened anything.
 *
 * Asserted as **the control answers to the selection, not to the catalogue** rather than as a layout.
 * Chips, a summary, a line of text — any of those satisfy this; what none of them may do is grow with
 * the number of options. That leaves the look to `DESIGN.md` and pins the property the decision was
 * actually about.
 *
 * Three readings, because each fails a different wrong answer:
 *   - nothing chosen shows nothing chosen — a control that lists the catalogue fails here;
 *   - what is chosen is shown — a control that shows nothing at all passes the first and fails this;
 *   - **the height does not follow the option count** — the one a renderer cannot satisfy by accident,
 *     measured by mounting the same field twice with three options and with thirty.
 *
 * Claims under attack: UI-009, A11Y-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const optionsOf = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ value: `v${index}`, label: `Opzione ${index}` }));

for (const host of HOSTS) {
  test(`a closed multiselect answers to what was chosen, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, count: number, chosen: string[]) => {
      await page.evaluate(async ({ api, id, options, chosen }) => {
        await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(id, [{ name: "s", kind: "multiselect", label: "S", options, initialValue: chosen }]);
      }, { api: host.api, id, options: optionsOf(count), chosen });
      await page.waitForTimeout(350);
      return page.evaluate((id) => {
        const root = document.querySelector(`[data-form="${id}"]`);
        if (root === null) return null;
        const visible = (element: Element) => element.getBoundingClientRect().height > 0;
        return {
          height: Math.round(root.getBoundingClientRect().height),
          chips: Array.from(root.querySelectorAll(".mdy-chip")).filter(visible).length,
          expanded: root.querySelectorAll('[aria-expanded="true"]').length,
        };
      }, id);
    };

    const empty = await mount("few-empty", 3, []);
    expect(empty, "nothing was mounted, so there is no control to read").not.toBeNull();
    expect(empty!.expanded, "the popup is open, so this is not the closed control").toBe(0);

    expect(
      empty!.chips,
      `a closed multiselect with nothing chosen is showing ${empty!.chips} chips — it is listing what ` +
        `is on offer, so everything offered is in the tab order, read out and clickable before anybody ` +
        `has opened it`,
    ).toBe(0);

    // The control: a renderer that draws nothing at all would pass the assertion above and be useless.
    const chosen = await mount("few-chosen", 3, ["v0", "v2"]);
    expect(
      chosen!.chips,
      `two things were chosen and the closed control shows ${chosen!.chips} of them`,
    ).toBe(2);

    // The property the decision was about, and the one a renderer cannot satisfy by accident: the same
    // field with ten times the options, nothing chosen.
    const many = await mount("many-empty", 30, []);
    expect(
      many!.height,
      `with 3 options the closed control is ${empty!.height}px and with 30 it is ${many!.height}px — its ` +
        `height follows the catalogue rather than the selection, so a form of four such fields is a page ` +
        `of things nobody has picked`,
    ).toBe(empty!.height);
  });
}
