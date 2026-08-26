import { expect, test } from "@playwright/test";

/**
 * Every command inside the field answers both keys the platform binds to a button.
 *
 * A `<button>` is activated by `Enter` and by `Space`, and which of the two a person uses is not a
 * preference: someone who came from links presses one, someone who came from forms presses the
 * other, and assistive software sends whichever it was built around. There is no way to discover
 * from outside which one a control chose, so a command that answers only one is a command half the
 * people who reach it cannot operate — while the browser draws its focus ring and the page says it
 * can be done.
 *
 * **Both keys in the same run, per command.** Each key is consistent with itself: a file that
 * presses only `Enter` finds a control that works, and one that presses only `Space` finds another.
 * The gap exists only across the two, exactly as a panel's two doors agree only when both are opened
 * in one run.
 *
 * Two premises, and the file states both rather than assuming them:
 *
 * - **the pointer is the control.** A command that does nothing when pressed is a different defect,
 *   and it would otherwise be reported as a key that does not arrive.
 * - **focus is asserted before each key.** A key sent at a control that is not focused measures the
 *   aim, not the control — and it fails towards *defect*, which is the direction that costs a repair
 *   to sound code.
 */

/** The commands a filled field offers, by the class the contract gives them. */
const COMMANDS = [
  { name: "remove a value", selector: ".mdy-chip__remove" },
  { name: "clear every value", selector: ".mdy-multiselect__clear-all" },
] as const;

const KEYS = ["Enter", " "] as const;

test("a command answers both of the keys that activate a button", async ({ page }) => {
  await page.goto("/");
  const field = page.locator(".mdy-renderer--multiselect:visible").first();
  await field.waitFor({ state: "visible" });

  const held = () => field.locator(".mdy-multiselect__chips .mdy-chip").count();

  /**
   * Leaves the field holding at least one value, choosing one if the demo starts empty.
   *
   * The result is asserted rather than assumed: a routine that quietly fails to choose leaves an
   * empty field, and every command below is then "unanswered" for want of anything to act on — a
   * defect invented by the preparation, in the direction that blames the renderer.
   */
  const fill = async (): Promise<void> => {
    if (await held() > 0) return;
    await field.locator("[aria-expanded]").first().click();
    await page.waitForTimeout(250);
    const option = page.locator('.mdy-multiselect__options .mdy-chip, [class*="overlay"] .mdy-chip').first();
    if (await option.count() > 0) await option.click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    expect(
      await held(),
      "this file could not leave the field holding a value, so the commands it is about to press "
      + "have nothing to act on and every key would read as unanswered",
    ).toBeGreaterThan(0);
  };

  await fill();

  const unanswered: string[] = [];
  for (const command of COMMANDS) {
    for (const key of KEYS) {
      // Reloaded per reading: a command that worked has changed the value the next one acts on.
      await page.reload();
      await field.waitFor({ state: "visible" });
      await fill();
      const control = field.locator(command.selector).first();
      if (await control.count() === 0) continue;

      await control.focus();
      const focused = await control.evaluate((element) => element === document.activeElement);
      expect(
        focused,
        `${command.name} did not take focus, so pressing a key here would measure the aim rather `
        + "than the control — and it would read as a defect in code that is sound.",
      ).toBe(true);

      const before = await held();
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
      if (await held() === before) unanswered.push(`${command.name} · ${key === " " ? "Space" : key}`);
    }
  }

  // The control: the same commands, pressed. A field whose commands do nothing at all would put
  // every key in the list above and blame the keyboard for it.
  await page.reload();
  await field.waitFor({ state: "visible" });
  await fill();
  const byPointer = field.locator(COMMANDS[0].selector).first();
  const beforePress = await held();
  await byPointer.click();
  await page.waitForTimeout(250);
  expect(
    await held(),
    "the command does nothing when pressed either, so what is above is a field whose commands are "
    + "inert rather than a keyboard that cannot reach them",
  ).not.toBe(beforePress);

  expect(unanswered, `commands that draw a focus ring and answer only one of the two keys: ${unanswered.join(", ")}`)
    .toEqual([]);
});
