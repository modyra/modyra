/**
 * A picker that says it is a dialog, and does not say the page behind it is not.
 *
 * `projectTimepickerFieldA11y` publishes the dialog a time picker opens, and names three attributes
 * on it: `role="dialog"`, `aria-labelledby`, and **`aria-modal="true"`**.
 *
 * The third is the one with consequences. `role="dialog"` says *this is a dialog*; `aria-modal` says
 * *and everything behind it is not there*. Without it a screen reader's virtual cursor walks straight
 * out of the open picker into the form underneath, reading fields the user cannot reach with the
 * picker open, with nothing to say the picker is still there or that Escape is what closes it. The
 * pointer is fenced — the overlay light-dismisses — and the reading cursor is not.
 *
 * One renderer sets all three. The other sets the role on a different element and omits the modality.
 *
 * The other pickers are measured alongside and not asserted on: no projection declares a dialog for
 * them, and one renderer builds their calendar as a `grid` rather than a `dialog`, which is a
 * different and defensible reading of the same widget.
 *
 * Claims under attack: A11Y-002, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a time picker's dialog says the page behind it is not there, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise: this kind exists in the vocabulary the renderers build from.
    expect(MDY_WIDGET_KINDS, "the vocabulary no longer has a time picker").toContain("timepicker");

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("t", [{ name: "x", kind: "timepicker", label: "X" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    for (const selector of ['[data-form="t"] [aria-haspopup]', '[data-form="t"] button', '[data-form="t"] input']) {
      const candidate = page.locator(selector).first();
      if (await candidate.count() === 0) continue;
      await candidate.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      const open = await page.evaluate(() =>
        document.querySelector('[data-form="t"] [aria-expanded="true"]') !== null);
      if (open) break;
    }

    const dialogs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="dialog"]'))
        .filter((each) => each.getClientRects().length > 0)
        .map((each) => ({
          what: (each.getAttribute("class") ?? "").split(" ")[0],
          modal: each.getAttribute("aria-modal"),
          named: (each.getAttribute("aria-labelledby") ?? each.getAttribute("aria-label") ?? "") !== "",
        })));

    // The premise: it opened and built a dialog. A picker that never opened would have none, and
    // "no dialog without aria-modal" would be true and mean nothing.
    expect(dialogs.length, "the time picker opened no dialog, so its modality could not be read").toBeGreaterThan(0);

    const notModal = dialogs.filter((each) => each.modal !== "true").map((each) => each.what);
    expect(
      notModal,
      "a picker's dialog does not say the page behind it is out of play, so a reading cursor walks out of it",
    ).toEqual([]);
  });
}
