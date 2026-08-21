/**
 * A document saying which view its picker opens in, and the three renderers doing as they are told.
 *
 * `viewMode` is declarable now — in a dynamic document and as an attribute — and the controller has
 * always restored it on close (`timepicker-field-controller.ts:242`), so the declaration holds rather
 * than lasting until somebody touches the toggle. `a-view-a-picker-comes-back-to` pins that at the
 * controller. This is the same promise asked of the rendered page, which is where it was false.
 *
 * **Angular held `viewMode` as its own signal**: a picker told to open on the boxes opened on the face,
 * and the restore-on-close reached nothing. The contract owned the state and the renderer kept a
 * second copy — the third instance this month, and the first one a *document member* exposed, because
 * a local copy that only ever answers its own toggle looks correct until something outside asks for a
 * value. Nothing at the controller level could have seen it.
 *
 * So all three are driven here, and the third leg is the one that matters: **toggle, close, reopen.**
 * A renderer that reads the member on first open and then forgets it passes the first two legs.
 *
 * The view is read as *visible* rather than *present*: plain hides the face and keeps it in the
 * document where the other two remove it, and `structure.ts` declares both conforming.
 *
 * Claims under attack: UI-002, API-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_TIMEPICKER_INITIAL_VIEW } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

/** The view a picker is showing, by what a person can see rather than by what is in the document. */
const showing = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const face = document.querySelector(".mdy-timepicker-dial__face");
    return face !== null && face.getBoundingClientRect().width > 0 ? "dial" : "input";
  });

for (const host of HOSTS) {
  test(`a picker opens in the view its document asked for, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const openPicker = async (id: string, declared: Record<string, unknown>) => {
      await page.evaluate(async ({ api, id, declared }) => {
        await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(id, [{ name: "t", kind: "timepicker", label: "T", ...declared }]);
      }, { api: host.api, id, declared });
      await page.waitForTimeout(300);
      await page.locator(`[data-form="${id}"] .mdy-timepicker__toggle`).first().click({ force: true });
      await page.waitForTimeout(350);
    };

    // What a picker declaring nothing does. Compared against the published constant rather than
    // against "dial", so this keeps saying the same thing if the default is ever changed.
    await openPicker("plain-default", {});
    expect(
      await showing(page),
      `a picker declaring no view did not open in the one the contract publishes as its default`,
    ).toBe(MDY_TIMEPICKER_INITIAL_VIEW);

    await page.evaluate(({ api }) => (window as never as Record<string, { dispose(i: string): void }>)[api].dispose("plain-default"), { api: host.api });

    // And one that asks for the other. Derived from the constant for the same reason.
    const other = MDY_TIMEPICKER_INITIAL_VIEW === "dial" ? "input" : "dial";
    await openPicker("asked", { viewMode: other });
    expect(
      await showing(page),
      `a document declared viewMode: ${JSON.stringify(other)} and the picker opened on the other view — ` +
        `the member is accepted and ignored`,
    ).toBe(other);

    // The leg that catches a renderer holding its own copy: change the view the way a person does,
    // close, and open again. A renderer that reads the declaration once has already passed everything
    // above and fails here.
    await page.evaluate(() => (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click());
    await page.waitForTimeout(300);
    const afterToggle = await showing(page);
    expect(
      afterToggle,
      "the mode toggle did not change the view, so reopening would prove nothing about restoring it",
    ).toBe(MDY_TIMEPICKER_INITIAL_VIEW);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.locator('[data-form="asked"] .mdy-timepicker__toggle').first().click({ force: true });
    await page.waitForTimeout(350);

    expect(
      await showing(page),
      `after the person toggled to ${afterToggle} and closed it, reopening showed that view instead of ` +
        `the declared ${other} — the declaration lasted until somebody touched the toggle`,
    ).toBe(other);
  });
}
