/**
 * A dialog the control that opens it cannot name.
 *
 * `projectTimepickerFieldA11y` declares the popup as a dialog and says what that means:
 *
 *   id, role="dialog", aria-modal="true", aria-labelledby
 *
 * Three things, and each is a relationship rather than a decoration. The id is what the opener points
 * at, `aria-modal` is what tells a reader the rest of the page is out of play while it is up, and the
 * name is what it announces as.
 *
 * Both renderers put `role="dialog"` somewhere. Only one of them puts it where the opener is pointing.
 * In the other the dialog has no id at all, so `aria-controls` names a wrapper around it instead — an
 * element that exists, which is why this is not a dangling reference, and is not the dialog, which is
 * why following it arrives nowhere useful. The same dialog is not announced as modal.
 *
 * What is deliberately not asserted here is the name. The projection declares `aria-labelledby` and
 * one renderer uses `aria-label` instead; the computed name is "Meeting time" either way, so the
 * declaration is met by another route. Measured rather than assumed — the same check dismissed a
 * second finding on this control's trigger.
 *
 * Claims under attack: A11Y-004, A11Y-001.
 */

import { expect, test } from "@playwright/test";

import { projectTimepickerFieldA11y } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

const STATE = {
  label: "X", open: true, format: "12h",
  draft: { hour: 10, minute: 30, period: "AM" },
  value: "10:30",
  disabled: false, readonly: false, required: false, invalid: false, touched: false, dirty: false,
};

for (const host of HOSTS) {
  test(`the opener points at the dialog it opens, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const declared = (projectTimepickerFieldA11y(STATE as never, [], { widgetId: "w" }) as never as
      Record<string, { attributes?: Record<string, unknown> }>).dialog.attributes ?? {};

    // The premise, read from the contract rather than assumed: this part is a modal dialog.
    expect([declared.role, declared["aria-modal"]], "the projection no longer declares a modal dialog").toEqual(["dialog", "true"]);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(id: string, fields: unknown[]): unknown }>)[api]
        .mountFields("t", [{ name: "x", kind: "timepicker", label: "Meeting time" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    const openers = page.locator('[data-form="t"] button');
    let opened = false;
    for (let index = 0; index < await openers.count(); index += 1) {
      await openers.nth(index).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(220);
      if (await page.locator(".mdy-timepicker-dial").count() > 0) { opened = true; break; }
    }
    expect(opened, "no time popup opened, so nothing below is a measurement").toBe(true);

    const seen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const opener = document.querySelector('[role="combobox"]');
      const controls = opener?.getAttribute("aria-controls") ?? null;
      const target = controls === null ? null : document.getElementById(controls);
      return {
        hasDialog: dialog !== null,
        dialogHasId: dialog !== null && dialog.id.length > 0,
        modal: dialog?.getAttribute("aria-modal") ?? null,
        controls,
        pointsAtTheDialog: target !== null && target === dialog,
      };
    });

    // The control: there is a dialog and the opener is pointing at something, so what follows is
    // about where it points rather than about a popup that was never opened.
    expect(seen.hasDialog, "nothing in the popup carries the dialog role").toBe(true);
    expect(seen.controls, "the opener names nothing, which is a different finding than this one").not.toBeNull();

    expect(
      seen.dialogHasId,
      "the dialog has no id, so nothing in the document can point at it",
    ).toBe(true);

    expect(
      seen.pointsAtTheDialog,
      `the opener's aria-controls names ${JSON.stringify(seen.controls)}, which is not the element carrying the dialog role`,
    ).toBe(true);

    expect(
      seen.modal,
      "a dialog the projection declares modal does not say it is, so a reader is not told the page behind it is out of play",
    ).toBe("true");
  });
}
