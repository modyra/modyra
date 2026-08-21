/**
 * Choosing from a multiselect without a pointer.
 *
 * `MDY_WIDGET_KEYBOARD.multiselect` declares the whole path — `Enter@closed:open`, `ArrowDown@open:move`,
 * `Home`/`End@open:move`, `Enter@open:commit` — and `MDY_POPUP_OPENERS.multiselect` names the part that
 * opens it and the role it answers to. Driven with nothing but keys:
 *
 *     plain     opens · focus reaches the search box · ArrowDown moves nothing · Enter chooses nothing
 *     lit       opens · focus never leaves the opener · ArrowDown moves nothing · Enter chooses nothing
 *     angular   no opener at all — no [aria-haspopup], no [role="combobox"], no search button
 *
 * **In none of the three can a person choose a value from the keyboard.** Angular's is the widest: the
 * declared opener is not rendered, so nothing announces that a popup exists, and the overlay's search
 * input plus every option chip sit in the tab order while the control is closed — a screen reader is
 * walked through the whole catalogue before anything has been opened.
 *
 * This is the ground the reordering work is about to be built on. Moving a chosen value by keyboard has
 * no meaning in a control where choosing one by keyboard does not, so it is worth knowing before rather
 * than after — and worth being separate from that batch, because it is not a design question. Every one
 * of these keys is already declared.
 *
 * Asserted in two halves, because they fail differently:
 *   - **the declared opener is rendered and carries its declared role**, read from `MDY_POPUP_OPENERS`
 *     rather than from a class written here, so it keeps holding when the part is renamed;
 *   - **keys alone move the value**, which is the thing a person is trying to do.
 *
 * Claims under attack: A11Y-001, A11Y-004, UI-010.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const DECLARED = MDY_POPUP_OPENERS.multiselect!;
const OPENER_CLASS = (MDY_WIDGET_CONTRACTS.multiselect.parts as Record<string, { classes: string[] }>)[
  DECLARED.opener
]!.classes[0]!;

const OPTIONS = ["a", "b", "c", "d"].map((value) => ({ value, label: value.toUpperCase() }));

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page) => {
    await page.evaluate(async ({ api, options }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("k", [{ name: "s", kind: "multiselect", label: "S", options, searchable: true }]);
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(400);
  };

  test(`the declared opener is rendered and carries its role, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page);

    const found = await page.evaluate(({ openerClass, role }) => {
      const host = document.querySelector('[data-form="k"]');
      if (host === null) return null;
      const opener = host.querySelector(`.${openerClass}`);
      return {
        openerPresent: opener !== null,
        openerRole: opener?.getAttribute("role") ?? null,
        anythingWithRole: host.querySelectorAll(`[role="${role}"]`).length,
        anythingSayingPopup: host.querySelectorAll("[aria-haspopup]").length,
      };
    }, { openerClass: OPENER_CLASS, role: DECLARED.role });

    expect(found, "nothing was mounted").not.toBeNull();

    expect(
      found!.openerPresent,
      `the contract declares "${DECLARED.opener}" as what opens this popup — class .${OPENER_CLASS} — ` +
        `and the renderer builds no such element. Nothing announces that a popup exists ` +
        `(${found!.anythingSayingPopup} elements carry aria-haspopup)`,
    ).toBe(true);

    expect(
      found!.anythingWithRole,
      `the contract says the opener answers to role="${DECLARED.role}" and ${found!.anythingWithRole} ` +
        `elements carry it`,
    ).toBeGreaterThan(0);
  });

  test(`a value can be chosen with the keyboard alone, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page);

    const held = () =>
      page.evaluate(({ api }) =>
        (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("k")?.s ?? null,
        { api: host.api });

    expect(await held(), "the field did not start empty, so a choice would not be visible").toEqual([]);

    // Tab until the declared opener has focus, rather than counting presses. Counting asserts a
    // *position* in the tab order — this spec pressed Tab twice, which was right while the opener was a
    // search button and wrong the moment the anatomy changed, so it went red on a renderer that had
    // improved. Where the opener sits is the strip's business; that a keyboard can reach it is this
    // spec's.
    let reached = false;
    for (let press = 0; press < 12 && !reached; press += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(60);
      reached = await page.evaluate(
        (openerClass) => document.activeElement?.classList.contains(openerClass) ?? false,
        OPENER_CLASS,
      );
    }
    expect(
      reached,
      `twelve presses of Tab never reached the declared opener (.${OPENER_CLASS}), so a keyboard cannot ` +
        `get to this control at all`,
    ).toBe(true);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const chosen = await held();
    expect(
      Array.isArray(chosen) && chosen.length,
      `after tabbing to the opener and pressing Enter, ArrowDown, Enter the field holds ` +
        `${JSON.stringify(chosen)} — every one of ` +
        `those keys is declared in MDY_WIDGET_KEYBOARD.multiselect, and none of them chose anything. ` +
        `A control only a pointer can operate fails WCAG 2.1.1`,
    ).toBeGreaterThan(0);
  });
}
