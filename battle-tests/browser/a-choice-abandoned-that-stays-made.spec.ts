/**
 * Whether abandoning a choice abandons it.
 *
 * The platform's own colour chooser previews as a person moves: drag across the wheel and the page
 * behind updates on every step, which is the point — you judge a colour against the thing it will
 * colour. The chooser then offers two ways out, and only one of them means *keep this*.
 *
 * **What is under attack is what the other one means.** A person drags across the wheel, sees nothing
 * they want, and cancels. If every step of that drag was written into the field as it happened, and
 * nothing recorded what the field held before the chooser opened, then cancelling keeps the last
 * colour the pointer happened to pass over. The person asked for the choice to be abandoned and the
 * field abandoned the old value instead.
 *
 * **It is silent in the direction that matters.** Nothing looks broken: the field holds a valid
 * colour, the panel shows it selected, and it is a colour that was genuinely on the screen a moment
 * ago. The only person who can tell it is wrong is the one who cancelled, and only if they remember
 * what they had.
 *
 * **The chooser itself cannot be driven from here** — it belongs to the operating system, and no test
 * runner opens or cancels it. What can be driven is the mechanism the harm runs through: the native
 * element the chooser writes into, and whether what it writes lands in the field before anybody has
 * confirmed anything. A drag is that element reporting a series of values; a cancel is it reporting no
 * more. If a preview has already become the value, there is nothing left for a cancel to undo.
 *
 * **The premise is that the preview arrived at all.** A native element that ignores what this file
 * writes into it would leave the field untouched and pass for the least interesting reason there is,
 * so the field is read after the preview and a run where nothing moved says so instead.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .colors.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

/** What the field holds before anyone opens anything, and a colour dragged past on the way. */
const HELD = "#4361ee";
const PASSED_OVER = "#b91c1c";

for (const host of HOSTS) {
  test(`a colour dragged past and abandoned is not the field's, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, held }) => {
      (window as never as Api)[api].mountFields("abandon", [{
        name: "c", kind: "colors", label: "Colore", initialValue: held,
      }] as never);
    }, { api: host.api, held: HELD });
    await page.locator('[data-form="abandon"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(300);

    const value = () => page.evaluate(({ api }) =>
      String(((window as never as Api)[api].valueOf as unknown as (id: string) => Record<string, unknown>)("abandon").c ?? ""),
      { api: host.api });

    const before = await value();
    expect(
      before.toLowerCase(),
      `${host.name} did not start from the colour the document gave it, so what follows would be `
      + "measuring a field that was already somewhere else",
    ).toBe(HELD);

    // The chooser opens. Nothing is confirmed; a person is still moving the pointer.
    const native = page.locator(`[data-form="abandon"] .${classOf("control")}, [data-form="abandon"] input[type="color"]`).first();
    expect(await native.count(), `${host.name} draws no native chooser for a colour field`).toBeGreaterThan(0);

    // One step of the drag: the chooser writes a colour and says so, exactly as it does while moving.
    await native.evaluate((element, passing) => {
      (element as HTMLInputElement).value = passing;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, PASSED_OVER);
    await page.waitForTimeout(300);

    const during = await value();
    // If the preview never reached the field, the cancel below has nothing to undo and this file
    // would pass without having asked anything.
    expect(
      during.toLowerCase(),
      `${host.name}: a colour written into the native chooser and announced never reached the field, `
      + `which still holds ${during}. The mechanism this file is about did not run`,
    ).toBe(PASSED_OVER);

    // The person cancels: the chooser closes and reports nothing further. No `change`, no confirmation.
    await native.evaluate((element) => {
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      element.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    await page.waitForTimeout(400);

    const after = await value();
    expect(
      after.toLowerCase(),
      `${host.name}: a colour the pointer passed over during a drag is now the field's value. `
      + `It held ${HELD}, a drag previewed ${PASSED_OVER}, the choice was abandoned, and the field `
      + `holds ${after}. Nothing recorded what it held before the chooser opened, so there is nothing `
      + "for an abandonment to restore — and nothing looks wrong afterwards: the field holds a valid "
      + "colour that was genuinely on the screen a moment earlier. Only the person who cancelled can "
      + "tell, and only if they remember what they had.",
    ).toBe(HELD);
  });
}
