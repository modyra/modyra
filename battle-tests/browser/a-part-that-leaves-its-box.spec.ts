/**
 * Whether a control stays inside itself.
 *
 * Every check in this suite until now asked *where does this part sit* — a question about the parts
 * somebody was already suspicious of. This asks the question underneath: **does anything the field
 * draws paint outside the field at all.** One assertion over every part, at every width, rather than
 * a comparison between two parts that somebody thought to compare.
 *
 * The difference is not academic. A misalignment and a part escaping its own box are the same
 * measurement — bounding boxes — and a check scoped to two named parts can only ever return the first.
 * It took a person looking at a screen to ask the second, which is the mark of a check that measures
 * the receipt rather than the goods.
 *
 * **What paints, not what a box says.** A scrolling row legitimately holds content wider than itself:
 * a chip scrolled out of view has a layout box far outside the field and paints nothing, so comparing
 * rectangles reports every such chip as escaped. The reading is taken by asking the document what is
 * actually at points just beyond each edge — which is the same question a person's eye asks.
 *
 * A part that overflows **and is clipped** is contained. A part that overflows and is *painted* is
 * not, and the difference is a scrollport: without one, off-edge content is not merely awkward but
 * unreachable, since no gesture brings it back.
 *
 * Swept across widths because the failure is a layout one: a field that contains itself at 1200px may
 * not at 320, and the width where it stops is not a number anyone chose.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: `v${index}`,
  label: `Amministrazione centrale ${index}`,
}));

const WIDTHS = [320, 480, 700, 1_200];

for (const host of HOSTS) {
  test(`nothing a field draws paints outside it, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const escaped: string[] = [];
    let measured = 0;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 700 });

      for (const kind of MDY_WIDGET_KINDS) {
        const id = `box_${kind}_${width}`;
        await page.evaluate(({ api, id, kind, options }) => {
          (window as never as Api)[api].mountFields(id, [
            { name: "f", kind, label: "Scelte", clearable: true, options, initialValue: undefined },
            // A field after it, so anything escaping has somebody else's space to land in.
            { name: "after", kind: "text", label: "Dopo" },
          ] as never);
        }, { api: host.api, id, kind, options: OPTIONS });

        const root = `[data-form="${id}"]`;
        await page.locator(root).waitFor({ timeout: 5_000 });
        await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
        await page.waitForTimeout(120);

        const outside = await page.evaluate((selector) => {
          const field = document.querySelector(`${selector} .mdy-input-wrapper`);
          if (field === null) return null;
          const box = field.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return [];
          const found = new Set<string>();
          for (let y = box.top + 4; y < box.bottom - 4; y += 6) {
            for (const x of [box.right + 3, box.right + 16, box.left - 3, box.left - 16]) {
              for (const element of document.elementsFromPoint(x, y)) {
                if (!field.contains(element)) continue;
                found.add(element.className.split(/\s+/).find((one) => one.startsWith("mdy-")) ?? element.tagName.toLowerCase());
              }
            }
          }
          return [...found];
        }, root);

        await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

        if (outside === null) continue;
        measured += 1;
        if (outside.length > 0) escaped.push(`${kind} at ${width}px paints ${outside.join(", ")} outside its own field`);
      }
    }

    // A run that mounted nothing would report no escapes for the wrong reason.
    expect(measured, `${host.name} measured no field at any width`).toBeGreaterThan(0);
    expect(escaped, `${host.name}: ${escaped.join("; ")}`).toEqual([]);
  });
}
