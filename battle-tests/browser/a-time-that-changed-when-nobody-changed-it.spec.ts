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

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

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
      // Through the parser, on both hosts. What this spec asserts is that the form does not end up
      // holding a time in a notation its own value contract refuses — and refusing it is the
      // parsing door's job, not a renderer's. Through the raw door `mountMdyForm` is handed the
      // string as given and keeps it, in both renderers alike; measuring that and calling it a
      // renderer defect confuses which door was opened.
      await page.evaluate(({ api, mountId, value }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[], o?: unknown): unknown }>)[api]
          .mountFields(mountId, [{ name: "meeting", kind: "timepicker", label: "Meeting", initialValue: value }], { parse: true });
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
      const opener = page.locator(`[data-form="${id}"] button[aria-label="Open time picker"]`);
      // **Never click what may not be there.** Through the parsing door a field whose initial value
      // the contract refuses is dropped entirely, so there is no opener — and a bare `click()` then
      // waits out the whole test budget and reports a timeout, which reads as the page hanging
      // rather than as the field being absent. Two three-minute failures came from that.
      await expect(
        opener,
        `no time picker was drawn for "${id}", so there is nothing to open — the field was refused ` +
          "before it reached the page",
      ).toHaveCount(1, { timeout: 5_000 });
      await opener.click();
      await expect(page.getByRole("button", { name: "OK", exact: true }).first()).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: "OK", exact: true }).first().click();
    };

    // The control, and the whole of what this spec can assert about the interaction: a value in the
    // contract's own notation survives being confirmed without a dial being touched.
    await mount("canonical", CANONICAL);
    expect(await stored("canonical")).toBe(CANONICAL);
    await confirmWithoutChanging("canonical");
    expect(await stored("canonical"), "a time nobody changed did not survive being confirmed").toBe(CANONICAL);

    // The same moment as a person would read it, and a notation the value contract does not carry.
    //
    // **This comes through the parsing door and asserts a refusal, not an interaction.** The raw
    // door is `mountMdyForm`'s own behaviour — it is handed the string and keeps it, in every
    // renderer alike — so measuring that and calling it a renderer defect names the wrong thing. I
    // filed one as a lit divergence before checking plain through the same door; it was not.
    //
    // Through the parser the field is refused outright, which is why there is nothing to confirm
    // here: a control that was never built cannot be interacted with, and asserting that it holds
    // nothing is the whole finding.
    await mount("displayed", DISPLAYED);
    expect(
      await stored("displayed"),
      "the form is holding a time in a notation its own value contract refuses",
    ).not.toBe(DISPLAYED);
    await expect(
      page.locator('[data-form="displayed"] button[aria-label="Open time picker"]'),
      "a field whose initial value the contract refuses was still drawn, so the refusal changed " +
        "nothing a person can see",
    ).toHaveCount(0);
  });
}
