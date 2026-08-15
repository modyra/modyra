/**
 * `aria-expanded`, on elements allowed to say it.
 *
 * An element announcing that it is expanded has to be something that can be: a `button`, or anything
 * carrying a role that permits the attribute — `combobox`, `link`, `treeitem`, and a short list
 * besides. A plain `<input type="text">` is a `textbox`, and a textbox has nothing to expand. Saying
 * so anyway is `aria-allowed-attr`, which axe rates critical: assistive technology is handed a state
 * for a role that has no such state, and what it does with it is anyone's guess.
 *
 * `MDY_POPUP_OPENERS` is where the intended answer lives. It names the part that opens each popup and
 * the role that part takes — `combobox` for the three kinds whose opener is the control the value is
 * typed into, nothing for the three whose opener is a button, because a button needs no help.
 *
 * One renderer follows it everywhere: every element carrying the state is a button or an input that
 * was given the combobox role first. The other gives two date inputs the state without the role.
 *
 * The rule is checked rather than the construction, so the same mistake on another kind fails the
 * same test.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/**
 * Roles that may carry `aria-expanded`.
 *
 * From the ARIA specification rather than from this package: the attribute belongs to roles that have
 * something to expand. A `button` has the attribute in its implicit role, which is why an element
 * that *is* a button needs no role of its own.
 */
const MAY_EXPAND = ["button", "combobox", "link", "treeitem", "row", "rowheader", "columnheader", "gridcell", "menuitem", "listbox"];

for (const host of HOSTS) {
  test(`only an element that can expand says it is expanded, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const wrong: string[] = [];
    let carriers = 0;

    for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
      const id = `e-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(220);

      const found = await page.evaluate(({ sel, allowed }) =>
        Array.from(document.querySelectorAll(`${sel} [aria-expanded]`)).map((each) => {
          const role = each.getAttribute("role");
          const isButton = each.tagName === "BUTTON" || each.tagName === "SUMMARY";
          return {
            what: `${each.tagName.toLowerCase()}${each instanceof HTMLInputElement ? `[${each.type}]` : ""}` +
              `${role === null ? "" : `[role=${role}]`}`,
            allowed: isButton || (role !== null && allowed.includes(role)),
          };
        }), { sel: `[data-form="${id}"]`, allowed: MAY_EXPAND });

      carriers += found.length;
      wrong.push(...found.filter((each) => !each.allowed).map((each) => `${kind}: ${each.what}`));

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(60);
    }

    // The control: something did say it was expanded. A run where nothing carried the attribute
    // would report nothing wrong and mean nothing by it.
    expect(carriers, "no element carried aria-expanded, so nothing was examined").toBeGreaterThan(2);

    expect(
      wrong,
      "an element says it is expanded while carrying no role that has anything to expand",
    ).toEqual([]);
  });
}
