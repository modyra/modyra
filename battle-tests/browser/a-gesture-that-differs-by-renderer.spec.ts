/**
 * Whether the same act is asked for by the same gesture everywhere.
 *
 * A pointer press is two events with a gap in between: it begins when the button goes down and it
 * completes when the button comes up. What happens in that gap is a decision, and it is the decision
 * that gives a person the escape every platform has taught them — press, see it is the wrong thing,
 * slide away, release, nothing happened. A control that acts on the way down has already acted before
 * the person can change their mind.
 *
 * **Which of the two a control acts on is a product decision and this file does not take it.** Both
 * are defensible: a native chooser opens as the button goes down, and a button activates as it comes
 * up. What is not defensible is *both at once, in one library*. The same field, drawn from the same
 * contract by three renderers, cannot answer a different gesture in each — a person who learns the
 * control in one application has learned nothing transferable, and an application that swaps its
 * renderer changes a behaviour nobody wrote down.
 *
 * So this file asserts agreement rather than a value: it reads what each renderer does at each half of
 * the press and requires the three answers to be one answer. Whichever answer that is, the file stays
 * green, and it goes red the moment they part company.
 *
 * **A press that is abandoned is read as well as one that is completed.** Beginning a press on the
 * field, dragging far away and releasing there is the gesture a person makes to take something back,
 * and reporting only the completed press would leave the renderers free to disagree about the one that
 * matters most.
 *
 * **The control is a press that is completed in place.** A run where nothing opened anywhere would
 * satisfy every agreement below by agreeing on nothing at all, and would do it silently — so the
 * completed press is read too, and the file says so instead of passing.
 *
 * Claims under attack: A11Y-004, UI-007.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .multiselect.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

test("the gesture that opens a field is the same gesture in every renderer", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1_200, height: 700 });

  const reading: Array<{ host: string; onPressDown: string; afterAbandoned: string; afterCompleted: string }> = [];

  for (const host of HOSTS) {
    const mount = async (id: string) => {
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, mountId, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "m", kind: "multiselect", label: "Scelte", clearable: true, options, initialValue: ["a"],
        }] as never);
      }, { api: host.api, mountId: id, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(350);
    };

    const open = (id: string) => page.evaluate((mountId) =>
      document.querySelector(`[data-form="${mountId}"] [aria-expanded]`)?.getAttribute("aria-expanded") ?? "(none)", id);

    /** The centre of the mark at the trailing edge, which takes no pointer events and so reaches the field. */
    const aim = async (id: string) => {
      const box = await page.locator(`[data-form="${id}"] .${classOf("arrow")}`).first().boundingBox();
      expect(box, `${host.name} drew no mark at the trailing edge to aim at`).not.toBeNull();
      return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
    };

    await mount("gesture_down");
    const downAt = await aim("gesture_down");
    await page.mouse.move(downAt.x, downAt.y);
    await page.mouse.down();
    await page.waitForTimeout(250);
    const onPressDown = await open("gesture_down");
    // Dragged well clear of the field before releasing: the gesture for taking a press back.
    await page.mouse.move(downAt.x, downAt.y + 300, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const afterAbandoned = await open("gesture_down");

    await mount("gesture_whole");
    const wholeAt = await aim("gesture_whole");
    await page.mouse.click(wholeAt.x, wholeAt.y);
    await page.waitForTimeout(400);
    const afterCompleted = await open("gesture_whole");

    reading.push({ host: host.name, onPressDown, afterAbandoned, afterCompleted });
  }

  const table = reading
    .map((one) => `  ${one.host.padEnd(9)} on press down ${one.onPressDown.padEnd(7)} · abandoned `
      + `${one.afterAbandoned.padEnd(7)} · completed ${one.afterCompleted}`)
    .join("\n");

  // The control: a press that was completed in place opened the field. Without it every agreement
  // below is satisfied by three renderers that all do nothing, which is agreement about nothing.
  const deaf = reading.filter((one) => one.afterCompleted !== "true").map((one) => one.host);
  expect(
    deaf,
    `${deaf.join(", ")} did not open on a completed press either, so there is no working gesture here `
    + `to compare and the readings below are about a control nothing reaches:\n${table}`,
  ).toEqual([]);

  const atDown = new Set(reading.map((one) => one.onPressDown));
  expect(
    [...atDown],
    "the renderers disagree about whether a field is already open while the button is still down, so "
    + "the same act is asked for by a different gesture in each and a person who learns one has "
    + `learned nothing that carries to the others:\n${table}`,
  ).toHaveLength(1);

  const atAbandon = new Set(reading.map((one) => one.afterAbandoned));
  expect(
    [...atAbandon],
    "the renderers disagree about what a press begun on the field and released far away leaves "
    + `behind — which is the gesture a person makes to take something back:\n${table}`,
  ).toHaveLength(1);
});
