/**
 * A time nobody changed, and the one notation a form holds it in.
 *
 * `MDY_VALUE_CONTRACTS.timepicker` names what a timepicker holds — a time as `HH:mm` — and
 * `explainValueMismatch("timepicker", "02:30 PM")` refuses twelve-hour notation in those words.
 * Twelve-hour is what the control **shows**; it is not what the form keeps. The two are different
 * columns, and a page that confuses them sends a payload nobody downstream can parse.
 *
 * So there are two things to hold. A value in the contract's own notation survives being confirmed
 * without a dial being touched — nothing changed, so nothing should change. And a value in the
 * display's notation is never what the form ends up holding: mounted, it is refused rather than
 * kept, so the field is empty rather than holding a string its own contract rejects.
 *
 * Both hosts, because a notation kept by one renderer and not the other is the same defect seen from
 * one side.
 *
 * Claims under attack: UI-006.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** What a timepicker holds, in the notation its value contract names. */
const CANONICAL = "14:30";

/** The same moment as the control shows it, which is not a value the contract accepts. */
const DISPLAYED = "02:30 PM";

for (const host of HOSTS) {
  test(`a time nobody changed is the time that was there, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, initialValue: string) => {
      await page.evaluate(({ api, mountId, value }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "meeting", kind: "timepicker", label: "Meeting", initialValue: value }]);
      }, { api: host.api, mountId: id, value: initialValue });
      await page.waitForTimeout(320);
    };
    const stored = (id: string) => page.evaluate(({ api, mountId }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).meeting,
      { api: host.api, mountId: id });

    /**
     * Open the picker and confirm, without touching a dial.
     *
     * The popup is placed outside the form's own container in one of the renderers, so the buttons
     * are found on the page rather than under the field.
     */
    const confirmWithoutChanging = async (id: string) => {
      await page.locator(`[data-form="${id}"] button[aria-label="Open time picker"]`).click();
      await page.waitForTimeout(420);
      await page.getByRole("button", { name: "OK", exact: true }).first().click();
      await page.waitForTimeout(420);
    };

    // The control: a value in the contract's notation survives the interaction, so what the second
    // half finds is the notation rather than a confirmation that rewrites whatever it is given.
    await mount("canonical", CANONICAL);
    expect(await stored("canonical")).toBe(CANONICAL);
    await confirmWithoutChanging("canonical");
    expect(await stored("canonical"), "a time nobody changed did not survive being confirmed").toBe(CANONICAL);

    // The same moment as the control would show it. A document that carries this is carrying a value
    // the contract refuses, and what must not happen is the form holding it anyway.
    await mount("displayed", DISPLAYED);
    expect(
      await stored("displayed"),
      "the form is holding a time in a notation its own value contract refuses",
    ).not.toBe(DISPLAYED);

    await confirmWithoutChanging("displayed");
    expect(
      await stored("displayed"),
      "confirming without touching a dial left the field holding something other than a time",
    ).not.toBe(DISPLAYED);
  });
}
