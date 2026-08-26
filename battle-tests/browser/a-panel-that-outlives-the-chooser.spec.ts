/**
 * Whether the panel survives the thing it opens.
 *
 * A palette offers a row of colours and, after them, a way out to the platform's own chooser — the
 * one with the wheel and the eyedropper, for a colour the row does not hold. On several platforms
 * that chooser is a **separate window**. It takes the keyboard with it, and the page it was opened
 * from has focus nowhere inside it for as long as a person is choosing.
 *
 * **That is the whole difficulty.** A panel that closes when focus leaves it — which is what almost
 * every panel does, and correctly — closes on the way out to the chooser. The person picks a colour
 * in a window whose panel no longer exists, and comes back to a field with nothing to come back to:
 * the way out is gone with the panel that held it, and whatever they chose has nowhere to land.
 *
 * **The claim under attack is a defence.** The door is built to open the chooser without moving focus
 * into it. This file does not take that on trust: it presses the door and then does to the page what a
 * separate window does, and asks whether the panel is still there.
 *
 * **What a separate window does, exactly, and what it does not.** It takes the operating system's
 * focus: the page's window blurs, and the element that had focus inside the page still has it — there
 * is nowhere else in the page for it to go. It does *not* move focus to some other element on the
 * page. Those two are easy to run together and they are not the same event: moving focus to another
 * control is a person clicking elsewhere, and a panel that closes then is behaving correctly. Modelled
 * the sloppy way — focus moved away *and* the window blurred — this file reported a renderer for
 * closing on the one of the two that it is supposed to close on.
 *
 * **The premise is that the press arrived.** A door that no click reaches would leave the panel open
 * for the least interesting reason there is, so the native chooser's own element is watched, and a run
 * where nothing reached it says so instead of passing. This is the shape that has cost this suite more
 * false greens than any other: an experiment that does not perform the thing it claims to test.
 *
 * **A control is not judged for a door it does not have.** A renderer that offers no way out has
 * nothing to survive and is reported as such rather than counted as healthy.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .colors.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

for (const host of HOSTS) {
  test(`the panel outlives the chooser its door opens, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("outlive", [{
        name: "c", kind: "colors", label: "Colore",
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="outlive"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(250);

    await page.locator(`[data-form="outlive"] .${classOf("toggle")}`).first()
      .click({ timeout: 5_000 });
    await page.waitForTimeout(350);

    const panel = page.locator(`.${classOf("popup")}`).first();
    await expect(panel, `${host.name} pressed the toggle and no panel appeared`).toBeVisible({ timeout: 5_000 });

    const door = page.locator(`.${classOf("customEntry")}`).first();
    const hasDoor = await door.count() > 0 && await door.isVisible().catch(() => false);
    // A renderer with no way out has nothing to survive, and calling that healthy would be a green
    // for the absence of the feature this file is about.
    expect(hasDoor, `${host.name} opened a palette with no way out to the platform's chooser`).toBe(true);

    // Watch the chooser's own element, so a press that reaches nothing cannot read as a press.
    await page.evaluate((nativeClass) => {
      const store = window as never as Record<string, unknown>;
      store.mdyChooserReached = 0;
      for (const one of Array.from(document.querySelectorAll(`.${nativeClass}, input[type="color"]`))) {
        one.addEventListener("click", () => { store.mdyChooserReached = (store.mdyChooserReached as number) + 1; }, true);
      }
    }, classOf("control"));

    await door.click({ timeout: 5_000 });
    await page.waitForTimeout(250);

    const reached = await page.evaluate(() => (window as never as Record<string, number>).mdyChooserReached);
    expect(
      reached,
      `${host.name}: pressing the way out reached the platform's chooser ${reached} time(s), so nothing `
      + "was opened and whether the panel survives it is a question this run did not ask",
    ).toBeGreaterThan(0);

    // The window loses the operating system's focus. Nothing inside the page moves: that would be a
    // person clicking elsewhere, which is a different act with a different right answer.
    await page.evaluate(() => { window.dispatchEvent(new Event("blur")); });
    await page.waitForTimeout(400);

    const alive = await panel.isVisible().catch(() => false);
    expect(
      alive,
      `${host.name}: the panel closes when the window loses the operating system's focus, and the way `
      + "out to the platform's chooser is inside the panel. Where that chooser is a separate window, a "
      + "person picks a colour with the panel already gone and comes back to a field with nothing to "
      + "come back to — the door went with the panel that held it, and what they chose has nowhere to "
      + "land.",
    ).toBe(true);
  });
}
