/**
 * Two controls that do opposite things and are drawn the same way.
 *
 * A chip in the reorderable shape carries a control that moves it earlier and one that moves it later.
 * Both are painted from the **same mask, with no transform on either** — one chevron, one orientation,
 * twice. Their names are right, so a screen reader tells them apart; a person looking at the chip sees
 * the same arrow on both sides and has to work out from position which one goes back. Someone who has
 * learned that the left-hand arrow points the way it moves is wrong half the time, and nothing on
 * screen could have taught them otherwise.
 *
 * It is the mirror of a control with no mark at all: there a part was handed to a theme with nothing
 * to paint, here one part class occurs twice with no way to tell the theme which is which. Neither is
 * repairable in a stylesheet.
 *
 * **This asserts how the marks are made, not how they look, and the distinction is deliberate.** A
 * claim about what a person sees belongs on pixels — but *are these two drawn identically* is a claim
 * about construction, and when the construction is identical the appearance follows without needing to
 * be measured.
 *
 * Three pixel comparisons were tried and all three passed while the marks were provably identical:
 * comparing the two screenshots byte for byte (a clip carries whatever is beside the control, so the
 * same glyph on two backgrounds makes two files), and comparing painted positions against each
 * region's own background (the two backgrounds differ slightly, so the threshold selects different
 * pixels). **A green nobody can explain is worse than no check**, so the claim moved to the layer where
 * the evidence is unambiguous rather than the layer where it was most satisfying to take it.
 *
 * A mirrored glyph, a rotation, a different mask, a different element — any of them satisfies this.
 * What does not is the same source drawn the same way up.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`the two controls that move a chip are not drawn alike, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_400, height: 400 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("moves", [{
        name: "m", kind: "multiselect", label: "Servings", mode: "multi", reorderable: true,
        options: [{ value: "e", label: "Espresso" }, { value: "c", label: "Cornetto" }],
        // Three values, so a chip in the middle has both directions available to it.
        initialValue: ["e", "c", "c"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="moves"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const drawn = await page.evaluate(() => {
      const chip = document.querySelector('[data-form="moves"] .mdy-chip');
      if (chip === null) return null;
      // Everything that decides what a mark looks like, from the element and from the box a
      // pseudo-element generates — the mark is on the pseudo-element, which is where an earlier
      // reading of this control looked for it and did not find it.
      const describe = (element: Element) => {
        const own = getComputedStyle(element as HTMLElement);
        const before = getComputedStyle(element as HTMLElement, "::before");
        const after = getComputedStyle(element as HTMLElement, "::after");
        return [own.maskImage, own.backgroundImage, own.transform, own.rotate, own.scale,
          before.maskImage, before.backgroundImage, before.content, before.transform, before.rotate, before.scale,
          after.maskImage, after.backgroundImage, after.content, after.transform, after.rotate, after.scale,
          (element.textContent ?? "").trim()].join("|");
      };
      return Array.from(chip.querySelectorAll(".mdy-chip__move")).map((element) => ({
        name: element.getAttribute("aria-label") ?? "unnamed",
        drawnBy: describe(element),
      }));
    });

    // Two of them, or the reorderable shape did not draw the pair this file is about.
    expect(drawn?.length, `${host.name} drew no pair of move controls to compare`).toBe(2);
    // Both must be drawn by something, or "drawn alike" is two absences rather than one glyph twice.
    for (const one of drawn ?? []) {
      expect(one.drawnBy.replace(/none|normal|\||""/g, "").trim(), `${host.name}: "${one.name}" is drawn by nothing at all, which is a different defect`)
        .not.toBe("");
    }

    expect(
      drawn?.[0].drawnBy === drawn?.[1].drawnBy,
      `${host.name}: "${drawn?.[0].name}" and "${drawn?.[1].name}" are drawn from the same mark with the `
      + "same orientation. The only thing telling them apart is which side of the chip they sit on, and "
      + "a person who reads the arrow rather than the position is wrong half the time.",
    ).toBe(false);
  });
}
