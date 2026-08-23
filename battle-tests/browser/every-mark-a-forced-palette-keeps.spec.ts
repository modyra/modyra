/**
 * Every mark this library draws, in the palette the operating system supplies.
 *
 * A person who cannot read the ordinary palette turns on a high-contrast one, and the system then
 * forces backgrounds, text and borders to colours it guarantees. `mask-image` is **not** stripped —
 * the shape machinery survives — but the `background-color` the mask clips is replaced, so a mark
 * made by masking a coloured box is still being drawn, in the colour of the surface behind it. It
 * disappears for exactly the people who asked for more contrast, and for nobody else.
 *
 * **This is a technique, not a control.** The defect lives in how an icon is made, so it is present
 * wherever that technique is used and absent wherever another one is — which is why this sweeps every
 * declared part of every kind rather than the one control it was found on. The marks that survive are
 * as informative as the ones that vanish: they name the technique this repository already uses
 * successfully, so the repair is a copy rather than a decision.
 *
 * **It is invisible in every other mode by construction**, not by oversight. No ordinary run, no
 * photograph of the ordinary page, and no contrast measurement in the usual palette can meet it.
 *
 * `paintedFraction` and not `contrastOf` is the right question: a forced palette guarantees the
 * contrast and does not guarantee that anything is drawn at all.
 *
 * Rendered at three device pixels per CSS pixel. At one, a hairline mark is all blend — the same
 * artifact that once made this instrument report a mark's colour as a value in no stylesheet — and a
 * faint mark could read as an absent one, which is the exact mistake this file would otherwise make.
 *
 * Each part is its own control: the same region, the same crop, the same instrument, in both
 * palettes. A part that paints in one and not the other was erased by the palette, and neither
 * reading can be blamed on the other.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partClasses } from "@modyra/widgets";

import { decodePng, paintedFraction } from "../harness/what-a-region-paints.mjs";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Past a part's own border radius, so a container's edge is not counted as its content. */
const INSET = 3;
/** Enough of a part to hold a mark; a sliver is a border, not an icon. */
const SMALLEST = 10;
/** A crop no larger than an icon needs, so a wide part is not measured as mostly empty. */
const WIDEST = 60;

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];

for (const host of HOSTS) {
  test(`every mark survives a forced palette, ${host.name}`, async ({ browser }) => {
    test.setTimeout(300_000);

    const paints = async (forced: boolean) => {
      const context = await browser.newContext({
        viewport: { width: 1_000, height: 600 },
        deviceScaleFactor: 3,
        forcedColors: forced ? "active" : "none",
      });
      const page = await context.newPage();
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      const painted = new Map<string, number>();
      for (const kind of MDY_WIDGET_KINDS) {
        const contract = MDY_WIDGET_CONTRACTS[kind];
        if (contract === undefined) continue;

        const id = `palette_${kind}`;
        await page.evaluate(({ api, id, kind, options }) => {
          (window as never as Api)[api].mountFields(id, [{
            name: "f", kind, label: "Etichetta", clearable: true, options,
            initialValue: kind === "multiselect" ? ["a"] : undefined,
          }] as never);
        }, { api: host.api, id, kind, options: OPTIONS });
        await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
        await page.waitForTimeout(150);

        for (const part of Object.keys(contract.parts)) {
          const selector = (partClasses(kind, part) as string[]).map((one) => `.${one}`).join("");
          if (selector === "") continue;
          const element = page.locator(`[data-form="${id}"] ${selector}`).first();
          if (await element.count() === 0) continue;
          const box = await element.boundingBox().catch(() => null);
          if (box === null || box.width < SMALLEST || box.height < SMALLEST) continue;

          const shot = await page.screenshot({
            clip: {
              x: box.x + INSET,
              y: box.y + INSET,
              width: Math.min(box.width - INSET * 2, WIDEST),
              height: Math.min(box.height - INSET * 2, WIDEST),
            },
          }).catch(() => null);
          if (shot === null) continue;
          painted.set(`${kind}.${part}`, paintedFraction(decodePng(shot), { scale: 3 }).fraction);
        }

        await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });
      }

      await context.close();
      return painted;
    };

    const ordinary = await paints(false);
    const forced = await paints(true);

    // A part drawing nothing in an ordinary palette is a different defect, and this file must not
    // report it as an erasure: there was nothing to erase.
    const drawn = [...ordinary.entries()].filter(([, fraction]) => fraction > 0);
    expect(drawn.length, `${host.name} found no part painting anything at all, so nothing here could be erased`)
      .toBeGreaterThan(20);

    const erased = drawn
      .filter(([part]) => (forced.get(part) ?? 0) === 0)
      .map(([part, fraction]) => `${part} (${(fraction * 100).toFixed(1)}% → nothing)`);

    expect(
      erased,
      `${host.name}: ${erased.length} of ${drawn.length} painted parts vanish when the system supplies the palette — `
      + `${erased.join(", ")}. Each stays the right size, keeps its name and stays operable; only what a person `
      + "looks at is gone, and only for the people who turned the palette on.",
    ).toEqual([]);
  });
}
