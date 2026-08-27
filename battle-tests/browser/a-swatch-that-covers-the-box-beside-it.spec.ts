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
 * **The second half counts routes, because the mechanism it used to assert has been replaced.** The
 * swatch now opens the field's own list of ready colours in every renderer, so a press on it no
 * longer reaches the native input anywhere, and that is the decision rather than an oversight. What
 * survives the decision is the consequence a person feels: from the list, is there still a way to a
 * colour the list does not hold, or is the only one left knowing that `#ff6600` is an orange and
 * typing it?
 *
 * So this half asks **how many routes lead out**, which reads the same whichever way the decision had
 * gone, and requires that no renderer answer it differently from another. One route is what the
 * record settles on; the check that matters as much is that the three agree, because a route that
 * exists in two of three is a capability an application loses by changing renderer.
 *
 * **Both ways out are counted.** A page can ask the platform for its chooser directly or press the
 * element the platform listens to, and a press that was cancelled reached nothing — from outside, a
 * door that opens nothing looks exactly like one that works.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { partClasses } from "@modyra/widgets";

import { became, HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const selectorFor = (part: string) => (partClasses("colors", part) as string[]).map((one) => `.${one}`).join("");

/** How many ways each renderer leaves out of the list, filled as each one is measured. */
const routesOut: Record<string, number> = {};

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

    // The other half, in the terms the decision left: from the list a person is offered, how many
    // ways lead to a colour the list does not hold?
    const panel = page.locator(`[data-form="swatch"] ${selectorFor("toggle")}`).first();
    if (await panel.count() > 0) await panel.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);

    // Both doors, and a cancelled press counts as none.
    await page.evaluate((nativeClass) => {
      const store = window as never as Record<string, number>;
      store.mdyOut = 0;
      const asked = HTMLInputElement.prototype.showPicker;
      if (typeof asked === "function") {
        HTMLInputElement.prototype.showPicker = function patched(this: HTMLInputElement) {
          store.mdyOut += 1;
          try { return asked.call(this); } catch { return undefined; }
        };
      }
      document.addEventListener("click", (event) => {
        const target = event.target as Element | null;
        if (target === null || !target.matches(`${nativeClass}, input[type="color"]`)) return;
        if (event.defaultPrevented) return;
        store.mdyOut += 1;
      });
    }, selectorFor("control"));

    const door = page.locator(`[data-form="swatch"] ${selectorFor("customEntry")}, .${"mdy-colors__custom-entry"}`).first();
    if (await door.count() > 0) await door.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(300);

    routesOut[host.name] = await page.evaluate(() => (window as never as Record<string, number>).mdyOut);

    expect(
      routesOut[host.name],
      `${host.name}: from the list of ready colours there is no way to a colour the list does not `
      + "hold. A brand's palette is a real reason to offer ten colours; it is not a reason to make "
      + "the eleventh reachable only by knowing that #ff6600 is an orange and typing it.",
    ).toBeGreaterThan(0);
  });
}

test("every renderer offers the same number of ways out of the list", async () => {
  const answers = Object.values(routesOut);
  // A run that measured fewer than all of them has nothing to compare and would agree with itself.
  expect(
    answers.length,
    `only ${answers.length} renderer(s) were measured: ${JSON.stringify(routesOut)}`,
  ).toBe(HOSTS.length);

  expect(
    [...new Set(answers)].length,
    "the number of ways out of the list of ready colours depends on who drew the field: "
    + `${JSON.stringify(routesOut)}. A route that exists in two of three is a capability an `
    + "application loses by changing renderer, from a document that asked for neither.",
  ).toBe(1);
});
