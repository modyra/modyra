/**
 * `aria-invalid` and `aria-required`, on elements entitled to have them.
 *
 * Both are states of a *widget*: something a person fills in or chooses from. A `textbox` can be
 * invalid, a `combobox` can be required, a native `<input>` carries the pair without asking. A
 * `button` cannot be either — pressing it is all it does — and neither can a `group`, which is a box
 * around other things rather than a thing with a value.
 *
 * axe calls the mismatch `aria-allowed-attr` and rates it critical: assistive technology is handed a
 * state for a role that has no such state.
 *
 * `MDY_POPUP_OPENERS` is where this begins. Three kinds declare `role: "combobox"` for the part that
 * opens their popup, and a combobox may carry both states. `multiselect` declares **no role**, so
 * whatever opens it is a bare button — and both renderers put the field's validity on it anyway,
 * because from the field's point of view that element *is* the control.
 *
 * Every other kind is clean in both renderers, which is what makes this a missing role rather than a
 * habit: where the contract names one, the state has somewhere to live.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** Roles with a value to be invalid or required about. */
const MAY_REPORT_STATE = [
  "combobox", "textbox", "searchbox", "spinbutton", "slider", "checkbox", "radio", "radiogroup",
  "listbox", "switch", "menuitemcheckbox", "menuitemradio", "tree", "treegrid", "grid", "application",
];

/** Elements that carry the states in their own right, whatever role they are given. */
const NATIVE_CONTROLS = ["input", "select", "textarea"];

for (const host of HOSTS) {
  test(`only a widget reports that it is invalid or required, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const wrong: string[] = [];
    let carriers = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `s-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(180);

      const found = await page.evaluate(({ sel, allows, native }) =>
        Array.from(document.querySelectorAll(`${sel} [aria-invalid], ${sel} [aria-required]`)).map((each) => {
          const role = each.getAttribute("role");
          const tag = each.tagName.toLowerCase();
          return {
            what: `${tag}${role === null ? "" : `[role=${role}]`}.${(each.getAttribute("class") ?? "").split(" ")[0]}`,
            entitled: native.includes(tag) || (role !== null && allows.includes(role)),
          };
        }), { sel: `[data-form="${id}"]`, allows: MAY_REPORT_STATE, native: NATIVE_CONTROLS });

      carriers += found.length;
      const offenders = [...new Set(found.filter((each) => !each.entitled).map((each) => each.what))];
      if (offenders.length > 0) wrong.push(`${kind}: ${offenders.join(", ")}`);

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(60);
    }

    // The control: the states were carried somewhere. A run where no element reported either would
    // find no offender and mean nothing by it.
    expect(carriers, "no element reported itself invalid or required, so nothing was examined")
      .toBeGreaterThan(MDY_WIDGET_KINDS.length / 2);

    expect(
      wrong,
      "an element reports a state its role has no room for, so assistive technology is told something about a thing that cannot be it",
    ).toEqual([]);
  });
}
