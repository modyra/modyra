import { expect, test } from "@playwright/test";

/**
 * Text cut short in a field that is mostly empty.
 *
 * A chip shortens its label when the strip runs out of room, which is right: a row of values has to
 * fit somewhere and an ellipsis is how it says there is more. What it may not do is shorten a label
 * while the field it sits in has hundreds of pixels of nothing to its right.
 *
 * Two consequences, and the first is the one a person meets. **At three characters two different
 * values render identically** — "Cornetto" and "Cornetto integrale" are both "Cor…" — so the visible
 * text stops identifying which value is which, and the strip stops being a record of what was chosen.
 * The second is that content is being lost before any reader has adjusted anything, which is the
 * condition text-resizing criteria are written against: there is no room to give back, because the
 * room was never taken.
 *
 * **This is measured here and not on the bare stage, and that is the point of the file.** A stage with
 * no theme gives a chip whatever width its content asks for and the truncation never occurs; the
 * theme is where a width comes from. Every reading like this one has reached the project through
 * somebody looking at a screen, and the reason is that the layer the product ships in was measured
 * only by pictures — a snapshot says a thing changed, never what is wrong with it.
 *
 * The rule is stated as a ratio rather than a number of characters: a label may be cut when the strip
 * is genuinely full, and may not while a quarter of the field is unused. The threshold is generous on
 * purpose — this is not a check about how much space a chip should take, it is a check about text
 * disappearing when nothing is competing for the room.
 */

/** How much of the field may be empty while a label is still being cut short. */
const SLACK = 0.25;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("no label is cut short while the field it sits in is mostly empty", async ({ page }) => {
  const cut = await page.evaluate((slack) => {
    const found: string[] = [];
    for (const renderer of document.querySelectorAll(".mdy-renderer")) {
      const field = renderer.querySelector(".mdy-input-wrapper");
      if (!(field instanceof HTMLElement)) continue;
      const room = field.getBoundingClientRect().width;
      if (room === 0) continue;

      for (const label of renderer.querySelectorAll('[class*="chip__label"]')) {
        if (!(label instanceof HTMLElement)) continue;
        // What the browser had to hide: the text's own width against the box it was given.
        const hidden = label.scrollWidth - label.clientWidth;
        if (hidden <= 1) continue;

        // How much of the field nothing is using. Measured from the strip's own end rather than
        // from the chips, so an affordance at the trailing edge is not counted as free room.
        const strip = renderer.querySelector('[class*="multiselect__chips"], [class*="__chips"]');
        const used = strip instanceof HTMLElement ? strip.getBoundingClientRect().width : room;
        const spare = (room - used) / room;
        if (spare <= slack) continue;

        found.push(
          `"${label.textContent?.trim()}" is cut by ${Math.round(hidden)}px `
          + `while ${Math.round(spare * 100)}% of a ${Math.round(room)}px field is unused`,
        );
      }
    }
    return found;
  }, SLACK);

  // A page with no chips has no label to cut, and would report none for the wrong reason.
  const chips = await page.locator('[class*="chip__label"]').count();
  expect(chips, "the themed page drew no chip, so this measured nothing").toBeGreaterThan(0);

  expect(
    cut,
    `${cut.length} label(s) are shortened with room to spare: ${cut.join("; ")}. At a few characters `
    + "two different values render identically, so the strip stops saying which one was chosen.",
  ).toEqual([]);
});
