/**
 * Clearing a number box and typing a new value into it.
 *
 * Reported directly: *"in plain quando cancello sui minuti 00 resta 00 e non riesco a mettere 01"*.
 * Measured, keystroke by keystroke, on a `24h` picker holding `09:00`:
 *
 *     plain     "00" → Backspace → ""   → type 0 → "00"  → type 1 → "001"
 *     lit       "00" → Backspace → "00" → type 0 → "00"  → type 1 → "00"
 *     angular   "00" → Backspace → "00" → type 0 → "00"  → type 1 → "00"
 *
 * **Plain pads to two digits on every keystroke.** Type `0` into an empty box and it becomes `00`
 * with the caret after it, so the `1` lands third and the box holds `001` — three characters in a
 * field that has two, and `01` unreachable by the route a person takes to it. The other two refuse
 * the edit outright and never leave `00`.
 *
 * Nothing declares what a segment may show *while it is being edited*, so each renderer chose: one
 * reformats after every character, two reformat away every character. A half-typed number is a real
 * state — every date and time field in every framework has one — and the contract is silent about it,
 * which is what the user meant by *"credo vadano contrattualizzati anche tutti questi comportamenti"*.
 *
 * What is asserted is the property rather than a keystroke sequence: **a box can be cleared and typed
 * back to any value the field offers**, and **no intermediate state is wider than the field**. Both
 * hold for any editing model a renderer might have — reformat on blur, reformat on commit, or accept
 * digits as they arrive — and neither holds for a box that pads mid-word.
 *
 * The user reports Angular behaving correctly in their own application. This spec does not reproduce
 * that: driven this way Angular refuses the edit too. Either the gesture differs or the fixture does,
 * and until that is measured the Angular row here is *unexplained rather than damning* — it is left in
 * so the difference is visible, not to convict a renderer on a sequence that may be the wrong one.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

for (const host of HOSTS) {
  test(`a minute box can be cleared and typed back, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("re", [{ name: "t", kind: "timepicker", label: "T", format: "24h", initialValue: "09:00" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    for (const selector of ['[data-form="re"] [aria-haspopup]', '[data-form="re"] button', '[data-form="re"] input']) {
      const opener = page.locator(selector).first();
      if (await opener.count() === 0) continue;
      await opener.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await page.locator(".mdy-timepicker-segment-input").count() > 0) break;
    }

    // Some renderers lock the boxes while the dial shows (finding 341). This spec is about typing, so
    // get to a view where typing is allowed rather than asserting 341 again from a second place.
    if (await page.evaluate(() => (document.querySelector(".mdy-timepicker-segment-input") as HTMLInputElement | null)?.readOnly === true)) {
      await page.evaluate(() => (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click());
      await page.waitForTimeout(250);
    }

    const minute = page.locator(".mdy-timepicker-segment-input").nth(1);
    expect(await minute.count(), "the picker drew no minute box").toBe(1);
    expect(
      await page.evaluate(() => (document.querySelector(".mdy-timepicker-segment-input") as HTMLInputElement | null)?.readOnly),
      "every view of this picker locks its boxes, so nothing here can be typed — that is finding 341",
    ).toBe(false);

    const seen: string[] = [];
    const note = async (label: string) => { seen.push(`${label}=${JSON.stringify(await minute.inputValue())}`); };

    await minute.focus();
    await note("start");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(120);
    await note("cleared");
    await page.keyboard.type("0");
    await page.waitForTimeout(120);
    await note("after0");
    await page.keyboard.type("1");
    await page.waitForTimeout(150);
    const ended = await minute.inputValue();
    await note("after01");

    // No state on the way may be wider than the field. This is what makes `01` unreachable: the box
    // is already full of padding before the second character arrives.
    for (const state of seen) {
      const value = state.slice(state.indexOf("=") + 1).replaceAll('"', "");
      expect(
        value.length,
        `the box held ${JSON.stringify(value)} while being typed into — wider than the two digits a ` +
          `minute has, so the next character has nowhere to go. Trail: ${seen.join(" → ")}`,
      ).toBeLessThanOrEqual(2);
    }

    expect(
      ended,
      `clearing the box and typing 0 then 1 left ${JSON.stringify(ended)} rather than "01". Trail: ` +
        seen.join(" → "),
    ).toBe("01");
  });
}
