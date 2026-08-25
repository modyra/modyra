/**
 * The keys a chip strip declares reach the code only for people who arrive one particular way.
 *
 * A screen reader on Windows has two modes. In **browse** mode the arrow keys move a virtual cursor
 * through the document and the reader **consumes** them — they never reach the page. In **forms** mode
 * they are passed to the application. The switch is automatic and it is decided by **the role of the
 * element that has focus**.
 *
 * Roles that switch: `combobox`, `listbox`, `tree`, `menubar`, `slider`, `spinbutton`, `tab`,
 * `textbox` — and the children of a composite when they take focus, an `option` inside a `listbox` or
 * a `gridcell` inside a `grid`. Roles that do **not**: `button`, `switch`, `group`, `link`, a `div`
 * with `tabindex`, and **`listitem`**.
 *
 * Measured, identical in all three renderers:
 *
 *     strip container   list
 *     focusable child   listitem, tabindex 0
 *
 * So a person who reaches this field by navigating — by headings, by landmarks, by jumping to the next
 * form field, which is **the normal way to move through a page** — puts focus on a chip, presses Right,
 * and moves the *virtual cursor* instead. Focus stays on the chip. The two come apart and do not
 * realign on their own, and not one key this widget declares arrives at the code.
 *
 * **The failure is silent and it is asymmetric.** Someone who arrives by Tab onto a role that switches
 * gets the whole keyboard model; someone who arrives by navigating gets none of it and **no way to
 * learn why**. There is no error — there is a control that does not answer.
 *
 * **And it may not be repaired by choosing which of the two experiences to serve.** A control that
 * behaves differently depending on how you reached it is not learnable: the variable that decides is
 * invisible, and it is not the person's. The repair is a pair of roles for which both routes land the
 * same way — `option` inside `listbox`, or `gridcell` inside `grid`.
 *
 * ## What this file is, and is not
 *
 * It asserts a **structural consequence of published behaviour**: the element that takes focus inside
 * the strip carries a role that hands the arrow keys to the application. That is checkable here.
 *
 * It does not measure what a person hears, because nothing in this suite can. Whether the strip should
 * become a listbox or a grid — they differ in what else they promise — is a decision for the contract
 * and for all three renderers together, and **no record states it yet**. This file holds the finding
 * red until one does; a reader meeting a contradiction should read it as a decision owed, not as a
 * renderer at fault.
 *
 * Claims under attack: A11Y-004, KBD-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";
import { whatAReaderWouldHear, everythingUnder } from "../harness/what-a-reader-would-hear.mjs";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/**
 * Container and child roles that put a screen reader into forms mode when the child takes focus.
 *
 * The pair matters rather than the child alone: an `option` outside a `listbox` is not a composite's
 * child, and the switch is a property of the composite.
 */
const HANDS_KEYS_TO_THE_PAGE: ReadonlyArray<readonly [string, string]> = [
  ["listbox", "option"],
  ["grid", "gridcell"],
  ["grid", "row"],
  ["tree", "treeitem"],
  ["tablist", "tab"],
  ["menu", "menuitem"],
  ["menubar", "menuitem"],
];

for (const host of HOSTS) {
  test(`the strip hands its arrow keys to the page, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_100, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("keys", [{
        name: "m", kind: "multiselect", label: "Città", mode: "multi", clearable: true, reorderable: true,
        options: [{ value: "a", label: "Roma" }, { value: "b", label: "Milano" }],
        initialValue: ["a", "a", "b"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="keys"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    // What the page says takes focus, and what the tree calls it. Both, because the DOM's `role`
    // attribute and the computed role can differ and the reader follows the computed one.
    const focused = await page.evaluate(() => {
      const chip = document.querySelector('[data-form="keys"] [tabindex]') as HTMLElement | null;
      if (chip === null) return null;
      chip.focus();
      const active = document.activeElement as HTMLElement | null;
      return active === null ? null : { tag: active.tagName.toLowerCase(), role: active.getAttribute("role") };
    });

    expect(
      focused,
      `${host.name} put nothing in the strip that takes focus, so there is no keyboard model here to `
      + "be reachable or unreachable",
    ).not.toBeNull();

    const { roots } = await whatAReaderWouldHear(page, '[data-form="keys"]');
    const all = (roots.flatMap((node: never) => everythingUnder(node)) as Array<{ role: string; ignored: boolean }>)
      .filter((node) => !node.ignored);

    const container = all.find((node) => HANDS_KEYS_TO_THE_PAGE.some(([outer]) => outer === node.role)
      || ["list", "group", "region"].includes(node.role));
    const child = all.find((node) => HANDS_KEYS_TO_THE_PAGE.some(([, inner]) => inner === node.role)
      || node.role === "listitem");

    // The premise: the strip reached the tree at all. A strip that is entirely ignored is a different
    // and larger finding, and this would be reporting the wrong one.
    expect(
      [container?.role, child?.role],
      `${host.name}: the strip did not reach the accessibility tree as a container and a child — `
      + `found ${JSON.stringify([container?.role, child?.role])}. Nothing here is measuring which mode `
      + "a reader would be in.",
    ).not.toEqual([undefined, undefined]);

    const pair: readonly [string, string] = [container?.role ?? "—", child?.role ?? "—"];
    const switches = HANDS_KEYS_TO_THE_PAGE.some(([outer, inner]) => outer === pair[0] && inner === pair[1]);

    expect(
      switches,
      `${host.name}: the strip is a ${pair[0]} holding a ${pair[1]}, and the element that takes focus `
      + `is <${focused!.tag} role="${focused!.role}">. A screen reader stays in browse mode on that `
      + "role, so its virtual cursor consumes the arrow keys and none of this widget's keyboard model "
      + "reaches the code. Someone who arrived by Tab has all of it; someone who arrived by navigating "
      + "— which is the normal way through a page — has none, and no way to find out why. The pairs "
      + `that hand the keys over are ${JSON.stringify(HANDS_KEYS_TO_THE_PAGE)}.`,
    ).toBe(true);
  });
}
