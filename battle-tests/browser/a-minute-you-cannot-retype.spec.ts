/**
 * Clearing a number box and typing a new value into it.
 *
 * Reported directly: *"in plain quando cancello sui minuti 00 resta 00 e non riesco a mettere 01"*.
 * Measured, keystroke by keystroke, on a `24h` picker holding `09:00`:
 *
 *     plain     "00" → Backspace → "00" → type 1 → "001"
 *     lit       "00" → Backspace → "0"  → type 1 → "01"
 *     angular   "00" → Backspace → "0"  → type 1 → "01"
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

    // The declared toggle first. The generic `[aria-haspopup]` sweep matches more than one thing in
    // some renderers and the loop then presses a second control, which in Angular left the boxes
    // rendered but never visible — a hang that read as a renderer defect and was this list's ordering.
    for (const selector of [
      '[data-form="re"] .mdy-timepicker__toggle',
      '[data-form="re"] [aria-haspopup]',
      '[data-form="re"] button',
      '[data-form="re"] input',
    ]) {
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
      // Waited for rather than slept through. A fixed pause is a guess about someone else's animation:
      // 250ms left Angular's boxes still invisible and the click hung for the whole test timeout, while
      // 350ms in a hand-run probe happened to be enough. The renderer was never the difference.
      await page.locator(".mdy-timepicker-segment-input").nth(1)
        .waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    }

    const minute = page.locator(".mdy-timepicker-segment-input").nth(1);
    expect(await minute.count(), "the picker drew no minute box").toBe(1);
    expect(
      await page.evaluate(() => (document.querySelector(".mdy-timepicker-segment-input") as HTMLInputElement | null)?.readOnly),
      "every view of this picker locks its boxes, so nothing here can be typed — that is finding 341",
    ).toBe(false);

    const seen: string[] = [];
    const note = async (label: string) => { seen.push(`${label}=${JSON.stringify(await minute.inputValue())}`); };

    // The gesture as it was reported, which is not the same as clearing the box: *"io ho 00, uso tasto
    // back del mac per cancellare e ho solo 0, a quel punto scrivo 1 e ottengo 01"*. One Backspace with
    // the caret at the end removes one character and leaves a one-digit partial.
    //
    // An earlier draft of this spec selected all and deleted, which is a different thing to do and gets
    // a different answer: it made lit and Angular look like they refused every edit when in fact both
    // handle the reported gesture correctly. The renderer was not what changed between the two runs.
    // Bounded, because an element that never becomes actionable hangs for the whole test timeout and
    // reports nothing useful: two and a half minutes of a suite waiting, then "test timeout exceeded".
    await minute.click({ timeout: 5_000 });
    await page.keyboard.press("End");
    await note("start");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(120);
    await note("afterOneBackspace");
    await page.keyboard.type("1");
    await page.waitForTimeout(150);
    await note("afterTyping1");

    // Read after leaving the box, because that is where the contract says the text settles. Mid-typing
    // it may legitimately be a partial — `"1"` is a minute this field offers, just not yet in canonical
    // form — and an earlier draft of this assertion demanded `"01"` while the caret was still inside,
    // which is the one thing the hybrid rule explicitly permits a renderer not to do.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    const ended = await minute.inputValue();
    await note("afterLeaving");

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
      `one Backspace on "00", typing 1, then leaving the box left ${JSON.stringify(ended)} rather ` +
        `than "01". Trail: ${seen.join(" → ")}`,
    ).toBe("01");
  });
}

/** The real hand's angle in degrees, from whatever the renderer used to rotate it. */
const handAngle = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const hand = Array.from(document.querySelectorAll(".mdy-timepicker-dial__hand")).find(
      (element) => !element.className.includes("--ghost"),
    ) as HTMLElement | undefined;
    if (!hand) return null;
    // The inline transform first — it is what every renderer writes — falling back to the matrix the
    // browser computed, so this reads a hand however it was turned.
    const inline = /rotate\(([-0-9.]+)deg\)/.exec(hand.style.transform ?? "");
    if (inline) return Math.round(((Number(inline[1]) % 360) + 360) % 360);
    const matrix = new DOMMatrixReadOnly(getComputedStyle(hand).transform);
    const degrees = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
    return Math.round(((degrees % 360) + 360) % 360);
  });

for (const host of HOSTS) {
  test(`the hand follows a half-typed number that the field accepts, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("hf", [{ name: "t", kind: "timepicker", label: "T", format: "24h", initialValue: "09:30" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);
    for (const selector of [
      '[data-form="hf"] .mdy-timepicker__toggle',
      '[data-form="hf"] [aria-haspopup]',
      '[data-form="hf"] button',
      '[data-form="hf"] input',
    ]) {
      const opener = page.locator(selector).first();
      if (await opener.count() === 0) continue;
      await opener.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await page.locator(".mdy-timepicker-segment-input").count() > 0) break;
    }

    // The whole point is that the two are visible together: the box being typed into and the hand that
    // answers it. A renderer that hides one while the other is in use cannot satisfy this at all.
    expect(
      await page.locator(".mdy-timepicker-dial__face").count(),
      "the dial is not showing, so there is no hand to follow the typing",
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => (document.querySelector(".mdy-timepicker-segment-input") as HTMLInputElement | null)?.readOnly),
      "the boxes are locked while the dial shows, so a half-typed number cannot exist to be followed — finding 341",
    ).toBe(false);

    const minute = page.locator(".mdy-timepicker-segment-input").nth(1);
    await minute.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    // The reported gesture, as in the sibling test: one Backspace with the caret at the end. Selecting
    // the whole box and deleting is a different thing to do and the renderers answer it differently —
    // measuring the wrong gesture is what put two working renderers in this register earlier.
    // The property, stated so it does not depend on the gesture: **the hand agrees with what the box
    // shows**. Which partial a given keystroke leaves is a renderer's own business — one Backspace
    // removes a character in plain and clears the box in lit, and both are correct — and these are
    // `type="number"` inputs, where selection does not exist and `Ctrl+A` is not a way to force a
    // shared starting point. Two earlier drafts of this test asserted fixed angles from a fixed
    // gesture and reported working renderers as broken, twice.
    //
    // So: type, then read both, then compare them to each other rather than to a number written here.
    const readings: string[] = [];
    await minute.click({ timeout: 5_000 });
    await page.keyboard.press("End");

    for (const key of ["Backspace", "1", "5"]) {
      if (key === "Backspace") await page.keyboard.press("Backspace");
      else await page.keyboard.type(key);
      await page.waitForTimeout(200);

      const shown = await minute.inputValue();
      const angle = await handAngle(page);
      readings.push(`${JSON.stringify(shown)}→${angle}°`);

      // Only when the box names a minute the field offers. An empty box and a half-typed number that
      // is not yet a value both leave the hand where it was, which is the other half of the rule.
      const value = shown === "" ? null : Number(shown);
      if (value === null || !Number.isInteger(value) || value < 0 || value > 59) continue;

      expect(
        angle,
        `the box shows ${JSON.stringify(shown)} — minute ${value}, which this field offers — and the ` +
          `hand is at ${angle}° rather than ${value * 6}°. The text and the hand are two views of one ` +
          `draft. Trail: ${readings.join(" ")}`,
      ).toBe((value * 6) % 360);
    }
  });
}
