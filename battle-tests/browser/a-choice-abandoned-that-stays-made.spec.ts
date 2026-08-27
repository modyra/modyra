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
 * runner opens or cancels it. What can be driven is the thing the chooser speaks through, and the
 * distinction it makes: a drag is reported as it happens, a choice is reported once, and they are two
 * different announcements. The property this file holds is that only the second one is a value.
 *
 * **Both halves, or neither means anything.** A field that took nothing from the chooser at all would
 * satisfy "a drag does not commit" perfectly, and would be broken. So the drag must leave the field
 * where it was *and* the choice must move it. Asserting only the first is a rule a dead control keeps
 * best of all.
 *
 * **What a person reported, and what it settles.** Leaving the platform's chooser by pressing
 * somewhere outside it **counts as choosing**: the colour under the pointer is taken. So that way out
 * is a confirmation and arrives as one, which is the half this file already holds — a choice
 * announced once becomes the value.
 *
 * **What it does not settle.** The chooser's own *cancel* is a different way out, and what it
 * announces — nothing, or a choice carrying the value the field started with — is still unmeasured.
 * No runner opens that window, so that half waits for a person rather than being deduced. If it
 * announces a choice carrying the dragged colour, the distinction this file holds is not enough.
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

/** What the field holds, a colour dragged past on the way, and one actually chosen. */
const HELD = "#4361ee";
const PASSED_OVER = "#b91c1c";
const CHOSEN = "#15803d";

for (const host of HOSTS) {
  test(`a step of a drag is not a choice, ${host.name}`, async ({ page }) => {
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

    // Steps of a drag: the chooser reports each colour the pointer moves over, as it moves over it.
    for (const passing of [PASSED_OVER, "#a16207", PASSED_OVER]) {
      await native.evaluate((element, colour) => {
        (element as HTMLInputElement).value = colour;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }, passing);
    }
    await page.waitForTimeout(300);

    const during = await value();
    expect(
      during.toLowerCase(),
      `${host.name}: a colour the pointer passed over during a drag is the field's value. It held `
      + `${HELD}, the pointer moved across ${PASSED_OVER} without stopping, and the field holds `
      + `${during}. Abandoning the choice now leaves whichever colour the pointer happened to be over, `
      + "because nothing recorded what was there before and there is nothing for an abandonment to "
      + "restore. Nothing looks wrong afterwards: the field holds a valid colour that was genuinely "
      + "on the screen a moment earlier, and only the person who cancelled can tell.",
    ).toBe(HELD);

    // The chooser closes with nothing chosen. It reports no choice, so nothing further arrives.
    await native.evaluate((element) => {
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      element.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    await page.waitForTimeout(300);

    expect(
      (await value()).toLowerCase(),
      `${host.name}: the chooser closed without a choice and the field moved anyway`,
    ).toBe(HELD);

    // The other half, without which the rule above is one a dead control keeps best of all: a colour
    // actually chosen is announced once, and that one is the value.
    await native.evaluate((element, chosen) => {
      (element as HTMLInputElement).value = chosen;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, CHOSEN);
    await page.waitForTimeout(350);

    expect(
      (await value()).toLowerCase(),
      `${host.name}: a colour announced as chosen did not reach the field, which still holds `
      + `${await value()}. A control that takes nothing from the chooser keeps "a drag is not a `
      + 'choice" perfectly and is broken, so this half is what makes the other half mean something.',
    ).toBe(CHOSEN);
  });
}
