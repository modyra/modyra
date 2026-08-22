/**
 * Whether the thing that says "this opens" is drawn at all.
 *
 * A field that opens something tells a person so with a mark at its inline end — a caret, a calendar,
 * a clock, a swatch. The catalogue names that mark per kind: it is a declared part, and a person who
 * cannot see one has no way to know the field does anything.
 *
 * A native chooser draws its own, and this library sets `appearance: none` on it — deliberately, so
 * that one kind does not look like the platform while its siblings look like the library. That is a
 * decision about consistency, and it comes with a debt: **whatever the platform was drawing has to be
 * drawn by the library instead.** Where the debt is unpaid the field is left with no affordance at
 * all, which is worse than either choice on its own.
 *
 * The check is per kind and per renderer, because this is precisely the failure that is uniform in
 * mechanism and scattered in incidence: one renderer draws the replacement, another sets the same
 * `appearance` and draws nothing.
 *
 * **Settled on pixels.** *Is there a mark a person can see* is a claim about perception, and a DOM
 * reading answers a different question — an element with the affordance's class, correctly sized and
 * carrying no ink, satisfies every structural check and shows nothing. The region is read where an
 * affordance belongs, at the field's inline end, rather than at a part's box, so a renderer that
 * draws the mark by a route this file did not predict still passes.
 *
 * Rendered at three device pixels per CSS pixel: a hairline caret at one is all blend, and a mark
 * that is present can read as absent.
 *
 * The renderers that draw one are the control — a run in which none of them painted anything would be
 * a broken crop rather than a finding, and it would read the same.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS, trailingAffordances } from "@modyra/widgets";

import { decodePng, paintedFraction } from "../harness/what-a-region-paints.mjs";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** How wide a slice of the field's inline end an affordance may occupy. */
const COLUMN = 44;

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];

for (const host of HOSTS) {
  test(`every kind that declares an affordance draws one, ${host.name}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 3 });
    const page = await context.newPage();
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const bare: string[] = [];
    const drawn: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      // Only kinds the catalogue says have something at their inline end.
      if ((trailingAffordances(kind) as unknown[]).length === 0) continue;

      const id = `affordance_${kind}`;
      await page.evaluate(({ api, id, kind, options }) => {
        (window as never as Api)[api].mountFields(id, [{ name: "f", kind, label: "Etichetta", options }] as never);
      }, { api: host.api, id, kind, options: OPTIONS });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(150);

      const field = await page.locator(`${root} .mdy-input-wrapper`).boundingBox().catch(() => null);
      if (field !== null && field.width > COLUMN && field.height > 12) {
        const shot = await page.screenshot({
          clip: { x: field.x + field.width - COLUMN, y: field.y + 4, width: COLUMN - 4, height: field.height - 8 },
        }).catch(() => null);
        if (shot !== null) {
          const painted = paintedFraction(decodePng(shot));
          if (painted.fraction === 0) bare.push(kind);
          else drawn.push(kind);
        }
      }

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });
    }

    await context.close();

    expect(drawn.length, `${host.name} painted nothing at the inline end of any kind, which is a crop and not a finding`)
      .toBeGreaterThan(0);

    expect(
      bare,
      `${host.name}: ${bare.length} kind(s) declare something at the field's inline end and paint nothing there — `
      + `${bare.join(", ")}. ${drawn.length} others draw theirs, so the mark is available and this one is missing.`,
    ).toEqual([]);
  });
}
