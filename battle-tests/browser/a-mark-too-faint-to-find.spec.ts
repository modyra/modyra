/**
 * Whether the marks on a control's own affordances can be seen.
 *
 * A multiselect's trailing controls — the way back, the clear, the arrow — say what they do with a
 * drawn mark and nothing else. No word, no outline a stylesheet guarantees: a glyph on the field's
 * own background. If that glyph is too close in luminance to what it sits on, the control is present,
 * focusable, announced, and invisible.
 *
 * **Published practice puts the floor at 3:1 for a graphical object**, which is what these are: they
 * are not text, and the rule for text does not apply to them. That number is the one asserted here.
 * The measured ratios are printed whatever the verdict, because a mark at 3.2:1 passes and is still
 * worth knowing about, and a run that only says "pass" cannot tell that from one at 12:1.
 *
 * **Captured at three device pixels per CSS pixel**, and the instrument refuses anything below two.
 * A one-pixel stroke reads 15.99:1 aligned to the grid and 3.21:1 on a half-pixel boundary, so a
 * ratio read at scale 1 measures where the edge fell rather than the ink. That is certified in
 * `a-ratio-a-thin-mark-can-carry.test.mjs`, and this is the first check to rest on it.
 *
 * The background is taken from the crop itself rather than from a stylesheet, so a theme that paints
 * the field a different colour is measured as a reader sees it and not as a rule says it should be.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { partClasses } from "@modyra/widgets";

import { became, HOSTS } from "./bench";
import { contrastOf, decodePng } from "../harness/what-a-region-paints.mjs";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const SCALE = 3;
const FLOOR = 3;

const MARKS = ["wayBack", "clearAll", "arrow"] as const;
const selectorFor = (part: string) => (partClasses("multiselect", part) as string[]).map((one) => `.${one}`).join("");

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }];

for (const host of HOSTS) {
  test(`every mark on a trailing control carries its own contrast, ${host.name}`, async ({ page, browser }) => {
    test.setTimeout(180_000);
    const shot = await browser.newContext({ deviceScaleFactor: SCALE });
    const paper = await shot.newPage();
    try {
      await paper.goto(host.page);
      await paper.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      // A value chosen, because the way back only exists once there is something to go back from.
      await paper.evaluate(({ api, options }) => {
        (window as never as Api)[api].mountFields("faint", [{
          name: "m", kind: "multiselect", label: "Scelte", clearable: true, options, initialValue: ["a", "b"],
        }] as never);
      }, { api: host.api, options: OPTIONS });
      await became(() => paper.locator(`[data-form="faint"] ${selectorFor("clearAll")}`).count().then((n) => n > 0));

      const readings: Array<{ part: string; ratio: number | null; why?: string }> = [];
      const read = async (part: string) => {
        const control = paper.locator(`[data-form="faint"] ${selectorFor(part)}`).first();
        if (await control.count() === 0) { readings.push({ part, ratio: null, why: "not drawn" }); return; }
        const box = await control.boundingBox();
        if (box === null || box.width < 1 || box.height < 1) { readings.push({ part, ratio: null, why: "no box" }); return; }
        const { ratio } = contrastOf(decodePng(await control.screenshot()), { scale: SCALE });
        readings.push({ part, ratio });
      };

      // **The order matters, and the first version got it wrong.** Pressing the clear is what makes
      // the way back appear, and it is also what makes the clear itself go away — there is nothing
      // left to clear. Reading all three afterwards measured two and reported the third as undrawn,
      // which is a mark going unchecked while the file passes.
      for (const part of MARKS.filter((one) => one !== "wayBack")) await read(part);

      await paper.locator(`[data-form="faint"] ${selectorFor("clearAll")}`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await became(() => paper.locator(`[data-form="faint"] ${selectorFor("wayBack")}`).count().then((n) => n > 0));
      await read("wayBack");

      console.log(`[${host.name}] ${JSON.stringify(readings)}`);

      // The premise: a run where nothing was drawn measures nothing, and reporting no faint mark
      // would be reporting on an empty page.
      const measured = readings.filter((one) => one.ratio !== null);
      expect(
        measured.length,
        `${host.name} did not draw all of ${MARKS.join(", ")} where this file reads them, so a mark went `
        + `unmeasured while the check below passed: ${JSON.stringify(readings)}`,
      ).toBe(MARKS.length);

      const faint = measured.filter((one) => (one.ratio as number) < FLOOR);
      expect(
        faint,
        `${host.name}: ${faint.length} mark(s) sit below ${FLOOR}:1 against the field they are drawn on — `
        + `${JSON.stringify(faint)}. A control whose only indication is a glyph nobody can pick out of the `
        + "background is present, focusable, announced, and invisible.",
      ).toEqual([]);
    } finally {
      await shot.close();
    }
  });
}
