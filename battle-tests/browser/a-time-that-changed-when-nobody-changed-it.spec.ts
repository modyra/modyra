/**
 * The same moment, stored two ways, decided by whether anybody opened the picker.
 *
 * A timepicker has two published formats. In `24h` the stored value is `"HH:mm"` — `"14:30"` is the
 * example the guide uses — and in the default 12h it is `"hh:mm A"`. The guide calls the stored value
 * canonical and display-independent *within the chosen format*, which is the whole sentence: the two
 * formats store different strings for the same moment.
 *
 * A form arriving as data has no way to choose. `format` is an attribute a host sets on a control;
 * `$defs.field` does not declare it, and a document that carries it anyway reaches a control that
 * does not read it. So every timepicker a document builds is 12h, and `"14:30"` — the machine form,
 * the one the guide prints — is a value in the other format.
 *
 * The widget accepts it, shows it, and leaves it alone. Then the user opens the picker and presses
 * OK without touching a dial, and the value becomes `"02:30 PM"`. Nothing about the time changed.
 * What changed is that the field has now been written once, and a write is normalised while a mount
 * is not.
 *
 * The consequence crosses the submission boundary: the same page, the same form, sends `"14:30"` or
 * `"02:30 PM"` depending on whether anybody opened a picker they did not need to open.
 *
 * The control is the same interaction on a value already in the field's own format, which is stable.
 * So this is the mount and the first write disagreeing, not a confirmation that always rewrites.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** The canonical 12h form, which is what the field normalises to. */
const CANONICAL = "02:30 PM";

/** The same moment in the other published format, and the one a document would carry. */
const OTHER_FORMAT = "14:30";

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

    // The control: a value already in the field's own format survives the same interaction, so what
    // happens below is the format rather than a confirmation that rewrites whatever it finds.
    await mount("canonical", CANONICAL);
    expect(await stored("canonical")).toBe(CANONICAL);
    await confirmWithoutChanging("canonical");
    expect(await stored("canonical"), "the canonical form did not survive being confirmed").toBe(CANONICAL);

    // The same moment, written the other way, which is the way a document writes it.
    await mount("other", OTHER_FORMAT);
    expect(await stored("other")).toBe(OTHER_FORMAT);
    await confirmWithoutChanging("other");

    expect(
      await stored("other"),
      "confirming without changing anything rewrote the stored time into the other format",
    ).toBe(OTHER_FORMAT);
  });
}
