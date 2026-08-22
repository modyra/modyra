/**
 * Where a field's trailing controls sit.
 *
 * A field's affordances — the caret that marks it openable, the button that clears it, a calendar, a
 * clock — are read as **one column at the field's inline end**. That is what makes a stack of fields
 * scannable: the eye follows a single vertical line down the form and finds every control in the same
 * place, whatever each field contains.
 *
 * `DESIGN.md` records both the rule and the way it breaks:
 *
 *   > A control fills the field it sits in. The affordance column only exists if the control reaches
 *   > the field's inline end. A control sized by its own text leaves the field's fill as empty space
 *   > beside it, and the affordance lands next to the value instead of on the edge — the alignment
 *   > reads as broken even though every affordance token is correct.
 *
 * That is this defect exactly. Every token is right: the glyph is the declared size, the box is the
 * declared box, the target is the declared target. The control holding them is sized by the chips
 * inside it rather than by the field, so the column lands wherever the last chip happens to end — and
 * moves every time a value is added, removed, or translated into a longer word.
 *
 * The consequence is not only that one field looks wrong. Two fields of different kinds in the same
 * form put their affordances at two different distances from the edge, so there is no column at all.
 *
 * **Every kind that draws one is swept**, because a rule about a column cannot be checked one field at
 * a time: the kinds that obey it are what prove the measurement is reading the property rather than a
 * constant, and a kind that starts disobeying it is caught the day it does.
 *
 * **Two things are measured, because one of them alone missed the defect it exists to catch.** The
 * distance from the *last* affordance to the field's trailing edge says whether the column reaches
 * the edge — and a single affordance sitting there satisfies it while every other one is stranded
 * beside the value. So the spread of the column is measured too: `DESIGN.md` says a user reads them
 * as one column, and two controls six hundred pixels apart are two columns.
 *
 * Reading the control's width instead would pin a layout technique; a caller may reach the edge by
 * filling, by growing, or by pushing the column with a spacer, and all three are the same answer to
 * the eye.
 *
 * The tolerance is the declared inset plus a pixel of rounding, and nothing else — a rule that
 * allowed "close enough" would be satisfied by the arrangement it exists to forbid.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS, partClasses, trailingAffordances } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`the trailing affordances sit at the field's inline end, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const wide: string[] = [];
    const reached: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `edge_${kind}`;
      await page.evaluate(({ api, id, kind }) => {
        (window as never as Api)[api].mountFields(id, [{
          name: "f", kind, label: "Scelte", clearable: true,
          options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        }] as never);
      }, { api: host.api, id, kind });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(250);

      // **The set comes from the catalogue, not from a guess at class names.** A pattern wide enough
      // to catch every renderer's spelling also catches a chip's remove button at the leading edge,
      // and the column then measures as the width of the whole field.
      const declared = (trailingAffordances(kind) as Array<{ part: string }>)
        .flatMap((each) => (partClasses(kind, each.part) as string[]).map((className) => `.${className}`))
        .join(", ");

      const measured = await page.evaluate(({ selector, declared }) => {
        const field = document.querySelector(`${selector} .mdy-input-wrapper`);
        if (field === null) return null;
        const box = field.getBoundingClientRect();
        const affordances = declared === "" ? [] : Array.from(field.querySelectorAll(declared));
        // A kind with no trailing control has no column to be wrong about.
        if (affordances.length === 0) return { none: true };
        const rightmost = affordances
          .map((element) => element.getBoundingClientRect())
          .reduce((furthest, rect) => (rect.right > furthest.right ? rect : furthest));
        const boxes = affordances.map((element) => element.getBoundingClientRect());
        const leftmost = boxes.reduce((nearest, rect) => (rect.left < nearest.left ? rect : nearest));
        return {
          none: false,
          gap: Math.round(box.right - rightmost.right),
          // How far the column is spread. One affordance is a spread of its own width.
          spread: Math.round(rightmost.right - leftmost.left),
          widest: Math.round(Math.max(...boxes.map((rect) => rect.width))),
          count: boxes.length,
          inset: getComputedStyle(field).getPropertyValue("--mdy-affordance-inset").trim(),
          width: Math.round(box.width),
        };
      }, { selector: root, declared });

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

      if (measured === null || measured.none === true) continue;

      // Read from the page rather than assumed, so a token change moves this spec with it.
      const insetPx = measured.inset?.endsWith("rem") === true
        ? Math.round(parseFloat(measured.inset) * 16)
        : Math.round(parseFloat(measured.inset ?? "4"));
      const allowed = (Number.isNaN(insetPx) ? 4 : insetPx) + 2;

      // One column: every affordance within a few of its own widths of the last. A generous bound —
      // it forbids a control stranded beside the value without prescribing the gaps between them.
      const together = (measured.spread ?? 0) <= (measured.count ?? 1) * (measured.widest ?? 0) + allowed;

      if ((measured.gap ?? 0) > allowed) {
        wide.push(`${kind} stops ${measured.gap}px short of a ${measured.width}px field`);
      } else if (!together) {
        wide.push(`${kind} spreads its ${measured.count} affordances over ${measured.spread}px, so they are not one column`);
      } else {
        reached.push(kind);
      }
    }

    // The kinds that obey the rule are the control: without them, "everything is wide" would be a
    // selector reading nothing rather than a column that is not there.
    expect(reached.length, `${host.name}: no kind reached the field's edge, so this spec measured nothing`)
      .toBeGreaterThan(0);

    expect(
      wide,
      `${host.name}: ${reached.length} kind(s) put their affordance on the edge and ${wide.length} do not — `
      + `${wide.join("; ")}. An affordance beside the value moves whenever the value's length changes, `
      + "so the form has no column for the eye to follow.",
    ).toEqual([]);
  });
}
