/**
 * Where a person clicks to type is the field, not one of its buttons.
 *
 * A text field with an affordance beside it — a calendar toggle, a clock, a colour swatch — is two
 * things sharing a box, and the box belongs to the input. The button sits at its trailing edge,
 * inside the frame, and everything to the left of it is somewhere a click puts a caret.
 *
 * Plain's datepicker is not built that way. The input is 1248px wide and runs from x=20 to x=1268;
 * the toggle is 28px wide at x=630, which is the input's exact midpoint. So the input runs *under*
 * its own button, and `document.elementFromPoint` at the centre of the field returns the toggle. A
 * person aiming at the middle of a wide, empty text field opens a calendar.
 *
 * The consequence is not only the misdirected click. Any check that finds a field and asks what is
 * at its centre — which is how a spec locates a control it did not build — gets the button, and its
 * failure is reported against whatever it was measuring rather than against the layout. One popup
 * spec has been intermittently red from exactly this.
 *
 * So the assertion is about the geometry rather than about any one control: the point at the centre
 * of a control's own text area belongs to that text area. It says nothing about where a button
 * should be, because there is more than one right answer to that and only one wrong one.
 *
 * Claims under attack: UI-011, A11Y-006.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** Kinds that draw a text area and an affordance in one box. */
//
// A colour field is left out, and it is the only exclusion. `input[type=color]` is deliberately
// covered by its swatch: the native control is a 1px anchor the browser positions its own picker
// against, and the visible thing a person clicks is the label over it. That is the pattern working,
// not a field running under its button, so measuring it here would report a design as a defect.
const PAIRED = ["datepicker", "daterange", "timepicker"];

for (const host of HOSTS) {
  test(`a field's own middle belongs to the field, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const covered: Array<Record<string, unknown>> = [];

    for (const kind of PAIRED) {
      // Mounted directly rather than through the bench: the bench builds a multiselect and refuses
      // anything else, and this defect is about a text field sharing its box with a button.
      const id = `mid_${kind}`;
      await page.evaluate(({ api, mountId, k }) => {
        (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
          .mountFields(mountId, [{ name: "f", kind: k, label: "F" }] as never);
      }, { api: host.api, mountId: id, k: kind });
      await page.waitForTimeout(400);
      const root = `[data-form="${id}"]`;
      const seen = await page.evaluate((sel) => {
        const form = document.querySelector(sel);
        const input = form?.querySelector("input:not([type=hidden])") as HTMLElement | null;
        if (input === null || input === undefined) return null;
        const box = input.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return null;

        const at = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        // The input itself, or something drawn inside it, both count: what is refused is a *sibling
        // control* taking the point.
        const mine = at !== null && (at === input || input.contains(at));
        const owner = at === null
          ? "nothing"
          : `${at.tagName.toLowerCase()}${at.getAttribute("aria-label") === null ? "" : `[${at.getAttribute("aria-label")}]`}`;
        return {
          mine,
          owner,
          inputWidth: Math.round(box.width),
          // Where the offender sits inside the field, as a fraction: 1.0 is the trailing edge, which
          // is where an affordance belongs, and 0.5 is the middle, which is this defect.
          at: at === null || mine ? null : Number(((at.getBoundingClientRect().left - box.left) / box.width).toFixed(2)),
        };
      }, root);

      // A kind that drew nothing measurable is **not** a pass. Angular renders one node for a
      // `daterange` — the bare form — and this check found nothing to measure and said nothing,
      // which is how a control that does not exist reads as a control laid out correctly.
      if (seen === null) covered.push({ kind, drew: "no field to measure" });
      else if (!seen.mine) covered.push({ kind, ...seen });
    }

    expect(
      covered,
      `a click at the centre of these fields lands on something else:\n${JSON.stringify(covered, null, 1)}`,
    ).toEqual([]);
  });
}
