/**
 * Whether the colour a person can pick sits beside the box they type into, or on top of it.
 *
 * A colours field offers two ways to say the same thing: a native colour well, which opens the
 * platform's own picker, and a text box for the hex value. They sit next to each other, and a person
 * chooses whichever suits them.
 *
 * **The native colour input is invisible.** It is styled away and a swatch is drawn over it, because
 * no two platforms draw a colour well the same way. That makes its box a thing nobody can see and
 * everybody can press: if it is a pixel wide, the well is unreachable by pointer; if it spans the
 * field, it sits over the hex box and takes every click meant for the text.
 *
 * Neither failure shows in a screenshot, because the element that causes them draws nothing. Both
 * show the moment a person tries to type a hex value.
 *
 * The check is on the **consequence**, not on the geometry: a press in the middle of the hex box has
 * to reach the hex box. A renderer that satisfies that has laid the two out in some workable way, and
 * one that fails it has an invisible element in front of a control, however the boxes measure.
 *
 * **The second half asserts a mechanism, and the mechanism is under decision.** Two renderers give
 * the swatch another job — it opens the list of preset colours — so the press not reaching the
 * native input is deliberate there rather than an oversight. What is not deliberate is the
 * consequence: with the swatch spoken for, a person who wants a colour that is not among the presets
 * has one way left, which is knowing that `#ff6600` is an orange and typing it.
 *
 * So the red these two carry is a **product decision that has not been taken**, not a defect
 * awaiting repair: whether a colours field must offer a pointer route to any colour at all, or may
 * legitimately restrict a pointer to an approved set. A brand's palette is a real reason to want the
 * second.
 *
 * When it is taken, this half is rewritten in its terms — as a count of the routes to an arbitrary
 * colour, which reads the same whichever way the decision goes, and which no renderer may answer
 * differently from another without that difference being declared.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { partClasses } from "@modyra/widgets";

import { became, HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const selectorFor = (part: string) => (partClasses("colors", part) as string[]).map((one) => `.${one}`).join("");

for (const host of HOSTS) {
  test(`a press meant for the hex box reaches it, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("swatch", [{
        name: "c", kind: "colors", label: "Colore", initialValue: "#ff0000",
      }] as never);
    }, { api: host.api });

    const hex = page.locator(`[data-form="swatch"] ${selectorFor("hexInput")}`).first();
    const well = page.locator(`[data-form="swatch"] ${selectorFor("control")}`).first();

    // The premise, in both directions: a field that draws only one of the two is not the field this
    // spec is about, and reporting it as laid out correctly would be reporting on nothing.
    await became(() => hex.count().then((found) => found > 0));
    expect(await hex.count(), `${host.name} drew no box to type a hex value into`).toBeGreaterThan(0);
    expect(await well.count(), `${host.name} drew no native colour input`).toBeGreaterThan(0);

    const boxes = await page.evaluate(({ hexSelector, wellSelector }) => {
      const read = (selector: string) => {
        const element = document.querySelector(`[data-form="swatch"] ${selector}`);
        if (element === null) return null;
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
      };
      return { hex: read(hexSelector), well: read(wellSelector) };
    }, { hexSelector: selectorFor("hexInput"), wellSelector: selectorFor("control") });

    expect(boxes.hex, `${host.name}: the hex box has no box on the page`).not.toBeNull();

    // **The consequence, not the geometry.** What is asked is where a press lands, because that is
    // what a person experiences and it holds however the two elements are arranged.
    await hex.click({ position: { x: 8, y: 8 }, timeout: 5_000 }).catch(() => undefined);
    const reached = await page.evaluate(({ hexSelector }) => {
      const wanted = document.querySelector(`[data-form="swatch"] ${hexSelector}`);
      const active = document.activeElement;
      return {
        onTheHexBox: active === wanted,
        landedOn: active === null ? "(nothing)" : `${active.tagName.toLowerCase()}.${String(active.className)}`,
      };
    }, { hexSelector: selectorFor("hexInput") });

    expect(
      reached.onTheHexBox,
      `${host.name}: a press in the hex box reached ${reached.landedOn} instead. The native colour `
      + `input is invisible and measures ${boxes.well?.w ?? "?"}×${boxes.well?.h ?? "?"} at `
      + `x=${boxes.well?.x ?? "?"}, over a hex box of ${boxes.hex?.w ?? "?"}×${boxes.hex?.h ?? "?"} at `
      + `x=${boxes.hex?.x ?? "?"} — a person typing a colour cannot reach the box they are aiming at, `
      + "and nothing on the screen tells them why.",
    ).toBe(true);

    // And the other half of the same arrangement: pressing the colour a person can see has to open
    // the picker.
    //
    // **Not measured as a target size.** All three renderers set `pointer-events: none` on the
    // native input and draw a swatch over it, so its own box is never what a pointer lands on and a
    // rule about how big it is asks for something no renderer does. What is asked instead is whether
    // the press arrives: something visible has to forward it, whether that is a label wrapping the
    // input or a handler calling it.
    const forwarded = await page.evaluate(({ wellSelector, previewSelector, toggleSelector }) => {
      const well = document.querySelector(`[data-form="swatch"] ${wellSelector}`);
      if (well === null) return { pressed: [] as string[], reached: false };
      let reached = false;
      well.addEventListener("click", () => { reached = true; }, { once: false });
      const pressed: string[] = [];
      for (const selector of [previewSelector, toggleSelector]) {
        const visible = document.querySelector(`[data-form="swatch"] ${selector}`) as HTMLElement | null;
        if (visible === null) continue;
        pressed.push(selector);
        visible.click();
        if (reached) break;
      }
      return { pressed, reached };
    }, { wellSelector: selectorFor("control"), previewSelector: selectorFor("preview"), toggleSelector: selectorFor("toggle") });

    expect(
      forwarded.pressed.length,
      `${host.name} drew nothing visible to press for a colour, so the check below asked nothing`,
    ).toBeGreaterThan(0);

    expect(
      forwarded.reached,
      `${host.name}: pressing the colour a person can see does not reach the native input behind it, `
      + `which measures ${boxes.well?.w ?? "?"}×${boxes.well?.h ?? "?"} and takes no pointer of its `
      + "own — so the only way left to set a colour is to type its hex value",
    ).toBe(true);
  });
}
