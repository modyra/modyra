/**
 * After a tap on the clock face: which field the dial draws, which the contract marks, and which the
 * keyboard reaches.
 *
 * Reported directly: *"in plain quando si clicca su un'ora, non si riesce a draggare la lancetta perché
 * passa subito ai minuti e ci sono problemi di passaggio di focus tra le view del dialer."* Both halves
 * are real and they are different defects.
 *
 * Tapping an hour and waiting for the handover, on a 24-hour face:
 *
 *     plain     face=minutes  marked=minute  DOM focus=hour   ArrowUp → 04:30   moved the HOUR
 *     lit       face=minutes  marked=minute  DOM focus=hour   ArrowUp → :30     emptied the hour
 *     angular   face=hours    marked=hour    DOM focus=hour   ArrowUp → 04:30   agrees with itself
 *
 * **One state, three expressions, and they disagree.** The dial draws the minutes, the segment the
 * contract marks is the minute, and the browser's focus is still in the hour box — so an arrow or a
 * digit edits the field the person is not looking at. Nothing on screen says which one will move.
 *
 * That is the pair this batch spent the night refusing everywhere else: `focusedField` and
 * `document.activeElement` are two views of one thing, and a handover that moves one and not the other
 * is the same defect as a hand that disagrees with its own box.
 *
 * Asserted as **agreement rather than as a value**: whichever field the handover lands on, all three
 * must name it. A renderer that advances and one that does not are both allowed by this spec — that
 * disagreement is its own finding — and neither is allowed to advance halfway.
 *
 * The keystroke is the last assertion rather than the first, because it is the consequence a person
 * meets and the other three are the reasons.
 *
 * Claims under attack: A11Y-001, UI-002.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

for (const host of HOSTS) {
  test(`the dial, the contract and the keyboard name the same field, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("h", [{ name: "t", kind: "timepicker", label: "T", format: "24h", initialValue: "09:30" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);
    await page.locator('[data-form="h"] .mdy-timepicker__toggle').first().click({ force: true });
    await page.waitForTimeout(350);

    const centre = await page.evaluate(() => {
      const face = document.querySelector(".mdy-timepicker-dial__face");
      if (!face) return null;
      const box = face.getBoundingClientRect();
      return { cx: box.left + box.width / 2, cy: box.top + box.height / 2 };
    });
    expect(centre, "no dial face was rendered, so nothing could be tapped").not.toBeNull();

    // Tap the 3 on the outer ring and wait past the handover, whatever its timing.
    await page.mouse.move(centre!.cx + 100, centre!.cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(700);

    const named = await page.evaluate(() => {
      const segments = Array.from(document.querySelectorAll(".mdy-timepicker-segment-input")) as HTMLInputElement[];
      const focusedIndex = segments.findIndex((element) => element === document.activeElement);
      const face = document.querySelector(".mdy-timepicker-dial__face");
      const firstNumber = face?.querySelector(".mdy-timepicker-dial__number")?.textContent?.trim();
      const markedIndex = Array.from(document.querySelectorAll(".mdy-timepicker-segment"))
        .findIndex((element) => /--focused|--active/.test(element.className));
      const asField = (index: number) => (index === 0 ? "hour" : index === 1 ? "minute" : "neither");
      return {
        // A minute face starts at 00; an hour face on a 24-hour clock starts at 12.
        drawn: firstNumber === "00" ? "minute" : "hour",
        marked: asField(markedIndex),
        focused: asField(focusedIndex),
        shown: segments.map((element) => element.value).join(":"),
      };
    });

    // The premise: something was chosen, or the handover this spec is about never happened.
    expect(named.shown, "the tap set no hour, so nothing here is about a handover").toBe("03:30");

    expect(
      named.marked,
      `the contract marks no segment as the focused one, so two of the three expressions cannot be ` +
        `compared — ${JSON.stringify(named)}`,
    ).not.toBe("neither");

    expect(
      { drawn: named.drawn, marked: named.marked, focused: named.focused },
      `the dial is drawing the ${named.drawn} face, the contract marks the ${named.marked} segment, and ` +
        `the keyboard is in the ${named.focused} box. One state with three expressions and they do not ` +
        `agree, so a keystroke edits the field the person is not looking at and nothing on screen says ` +
        `which one will move`,
    ).toEqual({ drawn: named.drawn, marked: named.drawn, focused: named.drawn });

    // The consequence, asserted last because the three above are its reasons: an arrow moves the field
    // the dial is showing.
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(250);
    const after = await page.evaluate(
      () => Array.from(document.querySelectorAll(".mdy-timepicker-segment-input"))
        .map((element) => (element as HTMLInputElement).value).join(":"),
    );
    const expected = named.drawn === "hour" ? "04:30" : "03:31";
    expect(
      after,
      `with the ${named.drawn} face showing, ArrowUp gave ${after} rather than ${expected} — the key ` +
        `reached a different field from the one on screen`,
    ).toBe(expected);
  });
}
