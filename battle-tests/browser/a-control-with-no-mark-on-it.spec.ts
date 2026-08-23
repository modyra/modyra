/**
 * A control that occupies space and draws nothing in it.
 *
 * In its counting shape a chip carries two controls that change the quantity — one fewer, one more.
 * Both are in the page, both are correctly named, both are 32×24, both are operable. In two of the
 * three renderers **not one pixel inside them differs from their background.**
 *
 * A person sees a chip with a wide blank area in it. Nothing invites the press and nothing warns
 * against it: the only way to find the controls is to press the blank and watch the number change.
 * It is the same hazard as an invisible target beside a destructive one, without even the visual to
 * avoid — and adjacent to a label, so someone aiming at the word activates a control instead.
 *
 * **This is settled on the pixels, and it has to be.** Every earlier version of this file enumerated
 * the ways a mark can be made — text, an `svg`, a background, a mask, a pseudo-element — and a claim
 * about what a person *sees* held together by a list of mechanisms is only as good as the list. One
 * such version treated `content: ""` as showing nothing and so reported a correctly drawn cross as
 * blank: it excluded the only mechanism in use and could not have passed on a working control.
 *
 * A DOM reading is sound for structure and unsound for perception. The verb here belongs to a person,
 * so the reading is taken after the browser has decided what a person gets, and no list can be wrong.
 *
 * The crop is inset so that the chip's own rounded edge does not read as a mark, and the fraction is
 * measured against the region's **own** dominant colour, so a theme that repaints everything is
 * measured on its own terms rather than against a colour named here.
 *
 * A renderer that draws its marks is the control: this fails on two and passes on one, from the same
 * measurement, which is what makes it a reading rather than a predicate with no true case.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { decodePng, paintedFraction } from "../harness/what-a-region-paints.mjs";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Inset past the chip's own border radius, so the container's edge is not counted as content. */
const INSET = 5;

for (const host of HOSTS) {
  test(`every control inside a chip draws a mark a person can see, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 400 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("marks", [{
        name: "m", kind: "multiselect", label: "Servings", mode: "multi",
        options: [{ value: "cor", label: "Cornetto" }],
        // A quantity above one, or the counting shape has nothing to count and draws no steppers.
        initialValue: ["cor", "cor", "cor"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="marks"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const controls = page.locator('[data-form="marks"] .mdy-chip button');
    const count = await controls.count();
    // The counting shape must have produced its controls, or this file measures a chip that has none.
    expect(count, `${host.name} drew ${count} control(s) inside a chip, so there was nothing to look at`)
      .toBeGreaterThan(2);

    const blank: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      const box = await control.boundingBox();
      if (box === null || box.width <= INSET * 2 || box.height <= INSET * 2) continue;

      const shot = await page.screenshot({
        clip: { x: box.x + INSET, y: box.y + INSET, width: box.width - INSET * 2, height: box.height - INSET * 2 },
      });
      // Captured at the viewport's own density, and that is sound *here* for one reason: the only
      // thing asserted below is a fraction of exactly zero, and a region that paints nothing paints
      // nothing however finely it is sampled. A threshold anywhere above zero would not survive it —
      // a hairline mark at half coverage can blend to within the tolerance of its background.
      const painted = paintedFraction(decodePng(shot), { scale: 1 });

      if (painted.fraction === 0) {
        const name = await control.getAttribute("aria-label");
        blank.push(`"${name ?? "unnamed"}" (${Math.round(box.width)}×${Math.round(box.height)})`);
      }
    }

    expect(
      blank,
      `${host.name}: ${blank.length} of ${count} controls inside a chip take space and paint nothing — `
      + `${blank.join(", ")}. The only way to find them is to press the blank and watch the value change.`,
    ).toEqual([]);
  });
}
