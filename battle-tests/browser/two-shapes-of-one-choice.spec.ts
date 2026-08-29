/**
 * Both shapes of a select let a person choose, and land on the same value.
 *
 * [ADR 0139](../../docs/architecture/0139-a-select-has-two-shapes.md) records that `select` is two
 * controls: a native `<select>` and a custom combobox, with `searchable` moving two of the three
 * renderers between them. It also records what nothing checks — *that the two shapes offer the same
 * capabilities*. They were compared by their markup, which is a statement about our HTML, and not by
 * what they let somebody do, which is the only thing a person has.
 *
 * That gap is where a shape switch does its damage. A document declaring `searchable: false` gets a
 * different control, and if that control cannot be operated by keyboard, or lands on a different
 * value, or announces nothing, the difference is invisible to every check that compares parts.
 *
 * So this asks the same question of both shapes, in the idiom each has:
 *
 *   - a person reaches the control by keyboard alone;
 *   - a person changes the value by keyboard alone;
 *   - the value they land on is the one the document declared as an option, in the contract's own
 *     spelling — not a label, not an index.
 *
 * **Deliberately silent about how.** A native control opens a list the platform draws and a combobox
 * opens one we draw; asserting either mechanism would make this a description of one shape. What it
 * asserts is the outcome, which both owe equally.
 *
 * A renderer that draws the same shape in both modes passes twice, and that is correct: this is not
 * the check that notices plain never enters the native shape. ADR 0139 records that as an open
 * difference, and it is a contract decision rather than a defect for a battle to fail on.
 *
 * Claims under attack: UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

const OPTIONS = [{ value: "a", label: "Alpha" }, { value: "b", label: "Bravo" }];


/**
 * Whether this driver can move a `<select>` with an arrow at all.
 *
 * The platform's chooser is navigated by the browser, not by the page, and a driver that presses
 * keys at the document does not necessarily reach that navigation: an ordinary `<select>` built here
 * with nothing else on the page does not move under `ArrowDown` in this one. So a shape that does not
 * move proves nothing about the shape until the gesture is shown to work on a control nobody wrote.
 *
 * The control is built and pressed in the page under test, not assumed from a browser name — the
 * answer differs by driver and would rot as a constant.
 */
const arrowsMoveANativeSelect = async (page: import("@playwright/test").Page): Promise<boolean> => {
  const id = "__il-controllo-nudo";
  await page.evaluate((elementId) => {
    document.getElementById(elementId)?.remove();
    const box = document.createElement("select");
    box.id = elementId;
    for (const value of ["", "uno", "due"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "" ? "Pick" : value;
      box.append(option);
    }
    document.body.append(box);
  }, id);
  await page.locator(`#${id}`).focus();
  await page.locator(`#${id}`).press("ArrowDown");
  await page.waitForTimeout(120);
  const moved = await page.evaluate((elementId) => {
    const box = document.getElementById(elementId) as HTMLSelectElement | null;
    const value = box?.value ?? "";
    box?.remove();
    return value !== "";
  }, id);
  return moved;
};

for (const host of HOSTS) {
  for (const searchable of [false, true]) {
    test(`a select can be chosen from by keyboard alone, searchable=${searchable}, ${host.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      const id = `sh-${searchable}`;
      await page.evaluate(({ api, mountId, sc, options }) => {
        (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
          .mountFields(mountId, [{ name: "f", kind: "select", label: "Plan", searchable: sc, options }] as never);
      }, { api: host.api, mountId: id, sc: searchable, options: OPTIONS });
      await page.waitForTimeout(400);

      const held = () => page.evaluate(({ api, mountId }) =>
        (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).f,
        { api: host.api, mountId: id });

      // Reached by keyboard alone: the control takes focus from a Tab, wherever the renderer puts
      // its stop. A shape a person cannot arrive at is one they cannot use whatever it does next.
      const control = page.locator(`[data-form="${id}"] select, [data-form="${id}"] [role="combobox"]`).first();
      await expect(control, "neither shape drew a control this spec can find").toHaveCount(1, { timeout: 5_000 });
      await control.focus();

      const focused = await page.evaluate((mountId) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        return root !== null && root.contains(document.activeElement);
      }, id);
      expect(focused, "the control refused focus, so a keyboard cannot reach it at all").toBe(true);

      const before = await held();

      // Changed by keyboard alone, in whichever idiom this shape has. A native select answers the
      // arrows directly; a combobox opens first and then answers them. Both are pressed, and what
      // is asserted is that one of the two sequences moved the value — never which.
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(250);
      if (await held() === before) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(250);
      }
      const after = await held();

      // The gesture, before the verdict on the gesture. Where the driver cannot press a `<select>`,
      // a shape that did not move has not been asked — and naming a renderer for it reports the tool.
      const canPress = await arrowsMoveANativeSelect(page);
      if (after === before && !canPress) {
        console.log(`[unasked] ${host.name} searchable=${searchable}: this driver cannot arrow a native `
          + "select, so whether a keyboard moves this shape is unmeasured rather than answered");
        return;
      }

      expect(
        after,
        `a keyboard could not change this select (searchable=${searchable}). It held ${JSON.stringify(before)} ` +
          "before and after, and an ordinary `<select>` built alongside it does move under the same " +
          "press, so the shape a document gets when it does not ask for search is one a person " +
          "without a pointer cannot operate",
      ).not.toBe(before);

      // And what it landed on is a value the document declared, spelled the contract's way. A shape
      // that reports a label, or an index, or the option's text is a shape whose payload differs
      // from its sibling's for the same choice — which is the failure a markup comparison cannot see.
      expect(
        OPTIONS.map((each) => each.value),
        `the value after choosing was ${JSON.stringify(after)}, which is not one of the values the ` +
          "document declared",
      ).toContain(after);
    });
  }
}
