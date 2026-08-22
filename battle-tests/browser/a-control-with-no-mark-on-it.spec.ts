/**
 * A control that occupies space and draws nothing in it.
 *
 * In its counting shape a chip carries two controls that change the quantity — one fewer, one more.
 * Both are in the page, both are named, both are 32×24, both are operable, and **neither draws
 * anything**: no text, no `svg`, no background image, no mask on the element or on either of its
 * pseudo-elements. A person sees a chip with a wide blank area where two controls are, and the only
 * way to find them is to press the blank and watch the number change.
 *
 * The number is not drawn either, so there is nothing in the chip to watch.
 *
 * **The remove control in the same chip is the proof this check works.** It draws its cross with a
 * masked pseudo-element — an empty `content` generating a box that a `mask-image` shapes — and it
 * passes. An earlier version of this file treated `content: ""` as *shows nothing* and so reported the
 * cross as blank: it excluded the only mechanism in use, and could not have passed on a correctly
 * drawn control. A detector with no true case is not a detector.
 *
 * So the two are distinguished here by the same predicate, which is what makes the reading a reading.
 *
 * **The check is for a mark of any kind, not a chosen one.** Text, an `svg`, an image, a background,
 * a mask, or a pseudo-element carrying real content all satisfy it; the stylesheet is free to draw
 * these however it likes, and only has to draw them.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`every control inside a chip draws its mark, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("marks", [{
        name: "m", kind: "multiselect", label: "Servings", mode: "multi", clearable: true,
        options: [{ value: "cor", label: "Cornetto" }, { value: "esp", label: "Espresso" }],
        initialValue: ["cor", "esp"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="marks"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(800);

    const report = await page.evaluate(() => {
      const drawn = (element: Element) => {
        if ((element.textContent ?? "").trim() !== "") return true;
        if (element.querySelector("svg, img, canvas") !== null) return true;
        const own = getComputedStyle(element as HTMLElement);
        if (own.backgroundImage !== "none") return true;
        if (own.maskImage !== "none" && own.maskImage !== "") return true;
        for (const pseudo of ["::before", "::after"]) {
          const style = getComputedStyle(element as HTMLElement, pseudo);
          if (style.content === "none") continue;
          // A generated box counts only if something shapes or fills it.
          if (style.maskImage !== "none" && style.maskImage !== "") return true;
          if (style.backgroundImage !== "none") return true;
          if (style.content !== '""' && style.content !== "''") return true;
        }
        return false;
      };

      const controls = Array.from(document.querySelectorAll('[data-form="marks"] .mdy-chip button'));
      return {
        total: controls.length,
        blank: controls.filter((control) => !drawn(control)).map((control) => {
          const box = control.getBoundingClientRect();
          const name = control.getAttribute("aria-label") ?? "unnamed";
          return `${control.className.split(/\s+/)[0]} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`;
        }),
      };
    });

    // Nothing to look inside means nothing measured — and the counting shape must have produced its
    // controls, or this file is reporting on a chip that never had any.
    expect(report.total, `${host.name} drew no control inside a chip`).toBeGreaterThan(2);

    expect(
      report.blank,
      `${host.name}: ${report.blank.length} of ${report.total} controls inside a chip take space and draw nothing — `
      + `${[...new Set(report.blank.map((one) => one.split(" ")[0]))].join(", ")}. `
      + "The only way to discover them is to press the blank and watch the value change.",
    ).toEqual([]);
  });
}
