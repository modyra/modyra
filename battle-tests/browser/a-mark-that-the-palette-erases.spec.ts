/**
 * What survives when the operating system supplies the colours.
 *
 * A person who needs a high-contrast palette turns one on, and the system then forces backgrounds,
 * text and borders to its own colours. Anything a control draws **as a background** is replaced;
 * anything it draws as text or as a border is recoloured and kept. That is the whole hazard: a mark
 * made by masking a coloured box is a background wearing a shape, and forcing the colour erases the
 * shape with it.
 *
 * These controls fail exactly that way. The cross that removes a chip is a box filled with a colour
 * and clipped to a cross by a `mask-image` — correct, sharp and scalable in every ordinary palette,
 * and **gone** the moment the system supplies its own. The button stays: the right size, the right
 * name, in the tab order, operable. Only the mark is missing, and only for the people who turned the
 * palette on because they could not see well enough without it.
 *
 * **This is the one failure mode no other run can see.** It is invisible in a normal palette by
 * definition, so nothing in this suite, no photograph of the ordinary page, and no amount of contrast
 * measurement in the usual mode would ever meet it. It needs the mode as much as it needs the pixels.
 *
 * The measurement is its own control: the same region, the same crop, the same instrument, taken
 * twice. A mark that paints in one palette and not in the other has been erased by the palette rather
 * than by the crop, and neither reading can be blamed on the other.
 *
 * `paintedFraction` and not `contrastOf` is the right question here: in a forced palette the system
 * guarantees the contrast, so the ratio is whatever it chose. What is not guaranteed is that anything
 * is drawn at all.
 *
 * Rendered at three device pixels per CSS pixel, so a hairline mark has fully-opaque pixels to be
 * seen by. At one, a thin stroke is all blend and a present mark can read as an absent one.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";

import { decodePng, paintedFraction } from "../harness/what-a-region-paints.mjs";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Past the control's own border radius, so a container's edge is not counted as its content. */
const INSET = 4;

/** Marks a person needs in order to tell one control from another. */
const MARKS = ".mdy-chip__remove, .mdy-chip__btn, .mdy-multiselect__clear-all, .mdy-multiselect__arrow";

for (const host of HOSTS) {
  test(`every mark a control draws survives a forced palette, ${host.name}`, async ({ browser }) => {
    const paints = async (forced: boolean) => {
      const context = await browser.newContext({
        viewport: { width: 900, height: 400 },
        deviceScaleFactor: 3,
        forcedColors: forced ? "active" : "none",
      });
      const page = await context.newPage();
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api }) => {
        (window as never as Api)[api].mountFields("palette", [{
          name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
          options: [{ value: "a", label: "Alfa" }], initialValue: ["a", "a"],
        }] as never);
      }, { api: host.api });
      await page.locator('[data-form="palette"]').waitFor({ timeout: 5_000 });
      await page.waitForTimeout(500);

      const found = new Map<string, number>();
      const marks = page.locator(`[data-form="palette"] ${MARKS}`);
      for (let index = 0; index < await marks.count(); index += 1) {
        const mark = marks.nth(index);
        const box = await mark.boundingBox();
        if (box === null || box.width <= INSET * 2 || box.height <= INSET * 2) continue;
        const shot = await page.screenshot({
          clip: { x: box.x + INSET, y: box.y + INSET, width: box.width - INSET * 2, height: box.height - INSET * 2 },
        });
        const name = `${await mark.getAttribute("aria-label") ?? "unnamed"} (${(await mark.getAttribute("class") ?? "").split(/\s+/)[0]})`;
        found.set(`${name}#${index}`, paintedFraction(decodePng(shot)).fraction);
      }
      await context.close();
      return found;
    };

    const ordinary = await paints(false);
    const forced = await paints(true);

    // A mark that draws nothing in an ordinary palette is a different defect, and one this file must
    // not report as an erasure: there was nothing to erase.
    const drawn = [...ordinary.entries()].filter(([, fraction]) => fraction > 0);
    expect(drawn.length, `${host.name} drew no mark at all in an ordinary palette, so nothing here could be erased`)
      .toBeGreaterThan(0);

    const erased = drawn
      .filter(([key]) => (forced.get(key) ?? 0) === 0)
      .map(([key, fraction]) => `${key.split("#")[0]} paints ${(fraction * 100).toFixed(1)}% ordinarily and nothing at all`);

    expect(
      erased,
      `${host.name}: ${erased.length} of ${drawn.length} marks vanish when the system supplies the palette — `
      + `${erased.join("; ")}. The controls stay operable and named; only the thing a person looks at is gone.`,
    ).toEqual([]);
  });
}
