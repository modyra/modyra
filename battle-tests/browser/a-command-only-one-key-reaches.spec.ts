/**
 * Whether a command a keyboard can reach is a command a keyboard can give.
 *
 * The field's commands are buttons, and they are reachable: a person walking the page with Tab
 * arrives at each of them, and the browser draws a focus ring to say so. Arriving is not operating.
 * A button that takes focus and then answers nothing is worse than one that cannot be reached at all,
 * because the reaching is a promise — the page has said *here is something you can do* and then
 * declines to do it, with no way to tell the difference from the outside.
 *
 * **A button answers two keys, and which one a person uses is not a preference.** The platform binds
 * both, and people use them interchangeably without knowing they are two: one is what a person raised
 * on links presses, the other what a person raised on forms presses, and screen reader and voice
 * control software sends whichever it was built around. A control that answers one of them works for
 * some people and not others, and neither group can discover the rule.
 *
 * **The remedy is the case that matters most.** Removing a value and undoing that removal are reached
 * the same way and are worth the same to a person who did the first by accident. A control where the
 * destruction answers a key and the remedy does not is not half-working: it is a control that takes
 * things away and will not give them back, from exactly the person who has no pointer to reach for.
 *
 * **Both configurations of the strip are exercised, because they carry different bindings.** When
 * the chosen values can be reordered, each chip takes keys of its own — and a key pressed on a button
 * *inside* a chip travels through the chip on its way out. A file that mounts only the arrangement
 * where the chip binds nothing cannot see a key being answered by the wrong owner: it would read a key
 * that arrives and does something else as a key that arrives and works, which is the direction that
 * hides the defect rather than inventing one.
 *
 * **The pointer is the control.** A command that does nothing by pointer either is a different defect
 * — nothing wired at all — and reporting it here would name the keyboard for something the keyboard
 * is not responsible for. So every command is exercised with a press first, in the same run, and this
 * file says so rather than blaming the key.
 *
 * **The focus is asserted before every key.** A key pressed while something else holds the reading
 * position is a reading about that other thing, and the failure it produces is indistinguishable from
 * a real one. Each command is focused, the focus is checked to have landed on it, and only then is the
 * key sent.
 *
 * Claims under attack: A11Y-001, A11Y-004.
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
const HELD = ["a", "b"];

/**
 * The two arrangements of the strip. They differ in what a chip binds for itself, which is what
 * decides whether a key pressed on a button inside a chip has more than one possible owner.
 */
const STRIPS = [
  { name: "a strip that does not reorder", reorderable: false },
  { name: "a strip whose chips take keys of their own", reorderable: true },
] as const;

/**
 * The commands the field draws, and whether the field has to be disturbed before one is offered.
 *
 * `afterRemoval` marks the remedy, which only exists once something has been taken away.
 */
const COMMANDS = [
  { name: "the remove on a chip", part: "chipRemove", afterRemoval: false },
  { name: "clear-all", part: "clearAll", afterRemoval: false },
  { name: "the way back", part: "wayBackAction", afterRemoval: true },
] as const;

/** Both keys the platform binds to a button. */
const KEYS = ["Enter", "Space"] as const;

for (const host of HOSTS) {
  test(`every command in the field answers both keys a button answers, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);

    const mount = async (id: string, reorderable: boolean) => {
      await page.setViewportSize({ width: 1_200, height: 700 });
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, mountId, options, held, reorderable }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "m", kind: "multiselect", label: "Scelte", clearable: true, reorderable, options, initialValue: held,
        }] as never);
      }, { api: host.api, mountId: id, options: OPTIONS, held: [...HELD], reorderable });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(350);
    };

    const value = (id: string) => page.evaluate(({ api, mountId }) =>
      JSON.stringify(((window as never as Api)[api].valueOf as unknown as (one: string) => Record<string, unknown>)(mountId)?.m),
      { api: host.api, mountId: id });

    /**
     * Gives one command one way and reports whether the field's value moved.
     *
     * `by` is either a key name or the press, so the pointer control travels the same path as the
     * keys and any difference between them belongs to the giving and not to the arranging.
     */
    const give = async (command: (typeof COMMANDS)[number], by: string, id: string, reorderable: boolean) => {
      await mount(id, reorderable);
      if (command.afterRemoval) {
        await page.locator(`[data-form="${id}"] .${classOf("chipRemove")}`).first().click({ timeout: 5_000 });
        await page.waitForTimeout(500);
      }
      const target = page.locator(`[data-form="${id}"] .${classOf(command.part)}`).first();
      if (await target.count() === 0) return { gone: true as const };
      const before = await value(id);

      if (by === "a press") {
        await target.click({ timeout: 5_000 });
      } else {
        await target.focus();
        await page.waitForTimeout(150);
        const landed = await page.evaluate((one) => document.activeElement?.matches(one) ?? false,
          `.${classOf(command.part)}`);
        if (!landed) return { misfocused: true as const };
        await page.keyboard.press(by);
      }
      await page.waitForTimeout(600);
      return { acted: (await value(id)) !== before };
    };

    const deaf: string[] = [];
    const unwired: string[] = [];
    const unreachable: string[] = [];

    for (const strip of STRIPS) {
      const where = `${strip.name}: `;
      for (const command of COMMANDS) {
        const tag = `${command.part}_${strip.reorderable ? "moves" : "still"}`;
        const byPress = await give(command, "a press", `key_${tag}_press`, strip.reorderable);
        expect(byPress, `${host.name} draws no ${command.name} in ${strip.name}`).not.toHaveProperty("gone", true);

        // The control. A command nothing operates is a different defect and is named as one.
        if (byPress.acted !== true) { unwired.push(`${where}${command.name}`); continue; }

        for (const key of KEYS) {
          const outcome = await give(command, key, `key_${tag}_${key}`, strip.reorderable);
          if ("misfocused" in outcome) { unreachable.push(`${where}${command.name} could not be focused`); continue; }
          if (outcome.acted !== true) deaf.push(`${where}${command.name} does not answer ${key}`);
        }
      }
    }

    expect(
      unwired,
      `${host.name}: ${unwired.join(", ")} did nothing when pressed either, so nothing here is wired `
      + "and the keys below would be blamed for a command that has no act at all",
    ).toEqual([]);

    expect(
      unreachable,
      `${host.name}: ${unreachable.join(", ")}, so a key sent next would have gone to whatever else `
      + "held the reading position and the reading would be about that",
    ).toEqual([]);

    expect(
      deaf,
      `${host.name}: a button answers both keys, and these answer one or neither — ${deaf.join("; ")}. `
      + "Every one of them takes focus first, so the page offers the command and then declines to "
      + "give it, and a person with no pointer to reach for has no way to tell which key this "
      + "particular control was built around.",
    ).toEqual([]);
  });
}
