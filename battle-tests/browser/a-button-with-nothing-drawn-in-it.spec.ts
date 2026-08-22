/**
 * A control a person can press and cannot see.
 *
 * Every chip in a multiselect carries a button that removes it. The button is there, it is the right
 * size, it is named "Remove" for a screen reader, and pressing it works. It draws nothing: no text,
 * no `svg`, no background image, no mask, and a `::before` whose content is the empty string — a slot
 * cut for a glyph with no glyph in it.
 *
 * So the control is complete for everyone except the person looking at it. A sighted person sees a
 * chip with a third of its width given to blank space, and the only way to discover that the blank
 * space removes the chip is to press it and watch the chip vanish. Nothing invites the press and
 * nothing warns against it.
 *
 * It is the exact inverse of the failure this suite usually finds. A missing accessible name is
 * invisible to the eye and obvious to a screen reader; this is obvious to a screen reader and
 * invisible to the eye, and it is the half nobody audits — an accessibility sweep passes it, because
 * by every rule an accessibility sweep knows, it is correct.
 *
 * **The check is for a mark of any kind, not for a chosen one.** Text, an `svg`, a background image,
 * a mask, or a pseudo-element carrying real content all satisfy it. Pinning one would pin an
 * implementation, and the stylesheet is free to draw this however it likes — it only has to draw it.
 *
 * The empty-string `::before` is what makes the intent legible: the space was reserved deliberately.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`every control a chip carries draws something, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("drawn", [{
        name: "s", kind: "multiselect", label: "Scelte",
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a", "b"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="drawn"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(900);

    const blank = await page.evaluate(() => {
      const drawn = (element: Element) => {
        if ((element.textContent ?? "").trim() !== "") return true;
        if (element.querySelector("svg, img, canvas") !== null) return true;
        const style = getComputedStyle(element as HTMLElement);
        if (style.backgroundImage !== "none") return true;
        if (style.maskImage !== "none" && style.maskImage !== "") return true;
        for (const pseudo of ["::before", "::after"]) {
          const content = getComputedStyle(element as HTMLElement, pseudo).content;
          // `""` is a pseudo-element that exists and shows nothing, which is the case this is about.
          if (content !== "none" && content !== '""' && content !== "''") return true;
        }
        return false;
      };
      return Array.from(document.querySelectorAll('[data-form="drawn"] .mdy-chip button'))
        .filter((button) => !drawn(button))
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return `${button.className.split(/\s+/)[0]} (${Math.round(rect.width)}×${Math.round(rect.height)}, named "${button.getAttribute("aria-label") ?? "nothing"}")`;
        });
    });

    // The chips must be there, or "no blank buttons" is the emptiness of the strip rather than a
    // control that draws itself.
    const chips = await page.locator('[data-form="drawn"] .mdy-chip').count();
    expect(chips, `${host.name} drew no chips, so there was nothing to look inside`).toBeGreaterThan(0);

    expect(blank, `${host.name} draws ${blank.length} control(s) inside a chip that a person cannot see: ${blank.join(", ")}`)
      .toEqual([]);
  });
}
