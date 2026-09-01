/**
 * Where the text a person types begins, measured from the edge of the field it is typed into.
 *
 * ADR 0182 decides that a field's inner inset is declared in one place and applied once, and that
 * the number is `1rem` whether a renderer draws the inliner or leaves the control's own padding to
 * carry it. The two spellings must agree, or the inliner becomes a way for one renderer to look
 * different while following the rules.
 *
 * **Nothing else on this board can see this property.** The sweeps compare heights, classes and
 * attributes; the visual baselines pin each renderer against its own past. A horizontal offset that
 * has always been there is invisible to both — which is how ten kinds came to disagree, seven of
 * them by the same twelve pixels, without a single check going red.
 *
 * Two things the record asks for, and they are the reason this file is shaped the way it is:
 *
 *   painted   A colour field carries two inputs, and the platform's own picker — `type="color"`,
 *             opacity zero, taken out of the flow — sits ahead of the box a person types into. Any
 *             selector taking *the first input that is not `type="hidden"`* measures a box no
 *             writing ever appears in, and reports a field with no inside. The type exclusion does
 *             not reach it: it is hidden by style, not by type.
 *
 *   the table A rule can lose to the cascade — wrong layer, or a one-class selector against a
 *             two-class one — and losing looks exactly like having applied. So the numbers are
 *             printed on every run, green included: **a number that has not moved is the only way
 *             to tell a rule that lost from a rule that is wrong.**
 *
 * The inset is read as a logical property, because the asymmetry this exists for is logical: the
 * leading inset belongs to the text and the trailing one to whatever affordance sits at the end. A
 * physical spelling put the extra room on the left under `dir=rtl`.
 *
 * Claims under attack: UI-011.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** `1rem` at the root size this bench draws at. The record names the rem; the page measures pixels. */
const INSET = 16;

/**
 * What a person types into. `type` is read from the property rather than the attribute so a control
 * that never spells it out still answers `"text"`, which is what the platform does with it.
 */
const WRITABLE = new Set([
  "text", "search", "email", "url", "tel", "password", "number", "date", "time",
  "datetime-local", "month", "week",
]);

for (const host of HOSTS) {
  test(`the writing begins at the same inset in every kind, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api, kinds }) => {
      (window as never as Api)[api].mountFields("inset", kinds.map((kind, index) => ({
        name: `f${index}`, kind, label: `L ${kind}`,
        options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      })) as never);
    }, { api: host.api, kinds: [...MDY_WIDGET_KINDS] });
    await page.waitForTimeout(700);

    const measured = await page.evaluate(({ writable }) => {
      const root = document.querySelector('[data-form="inset"]');
      if (root === null) return null;

      // A control the page hides from sight is not where the writing begins. Opacity, a clip, or a
      // box too small to hold a character all mean the same thing here: nothing a person reads
      // appears in it, so its inset is a number about an element nobody sees.
      const painted = (element: HTMLElement): boolean => {
        const box = element.getBoundingClientRect();
        if (box.width <= 2 || box.height <= 2) return false;
        const style = getComputedStyle(element);
        return style.clipPath === "none" && style.clip === "auto"
          && style.opacity !== "0" && style.visibility !== "hidden";
      };

      const rows: { kind: string; inset: number; from: string }[] = [];
      // The kind is read off the field's own modifier classes rather than a data attribute, because
      // the renderer writes the first and nothing writes the second. **Every** modifier, not the
      // first: a range draws itself as a datepicker and adds its own name beside it, so taking one
      // reports two different kinds under one label and leaves a row nobody can act on.
      for (const field of root.querySelectorAll<HTMLElement>(".mdy-renderer")) {
        const kind = [...field.classList]
          .filter((one) => one.startsWith("mdy-renderer--"))
          .map((one) => one.slice("mdy-renderer--".length))
          .join("+") || "?";
        const control = [...field.querySelectorAll<HTMLElement>("input, textarea")]
          .filter((one) => {
            const tag = one.tagName.toLowerCase();
            if (tag === "textarea") return true;
            return writable.includes((one as HTMLInputElement).type);
          })
          .find(painted);
        if (control === undefined) continue;

        // **The sum of the declarations, not the distance to the edge.** The record's own numbers are
        // the inliner's leading inset plus the control's, because those are the two places that
        // declare it and the text starts where they add up. A geometric distance from the wrapper's
        // edge answers a different question: it also swallows whatever painted affordance leads the
        // row, so a colour field reports its swatch as though the writing were inset by it, and a
        // kind is charged for a sibling instead of for a second declaration.
        const inliner = control.closest<HTMLElement>(".mdy-input-wrapper__inliner");
        const lead = (element: HTMLElement | null): number =>
          element === null ? 0 : Number.parseFloat(getComputedStyle(element).paddingInlineStart || "0");
        const outer = lead(inliner);
        const inner = lead(control);
        rows.push({
          kind,
          inset: Math.round((outer + inner) * 10) / 10,
          // The split, not only the sum: the decision is about *which* of the two declares the
          // inset, so a kind whose total is right by charging both halves is still the defect this
          // record names. `16` from `0+16` and `16` from `8+8` are the same number and not the same
          // state.
          from: inliner === null ? `control ${inner}` : `inliner ${outer} + control ${inner}`,
        });
      }
      return rows;
    }, { writable: [...WRITABLE] });

    expect(measured, `${host.name} drew no field to measure`).not.toBeNull();

    // The premise before the claim. A selector that matches nothing agrees with every rule, and a
    // page whose controls are all hidden reports an empty table that reads exactly like conformance.
    expect(
      measured!.length,
      "no writable control was found, so this measured nothing",
    ).toBeGreaterThan(3);

    // Printed on every run, not only on failure: the record asks for the numbers because a rule that
    // lost to the cascade and a rule that is wrong produce the same red, and only the table
    // distinguishes them.
    console.log(`[${host.name}] ` + measured!
      .map((row) => `${row.kind} ${row.inset}(${row.from})`).join(" · "));

    const wrong = measured!
      .filter((row) => Math.abs(row.inset - INSET) > 0.5)
      .map((row) => `${row.kind} begins at ${row.inset}px from its ${row.from}, not ${INSET}`);

    expect(
      wrong,
      `${wrong.length} kind(s) start their writing somewhere else:\n${wrong.join("\n")}\n\n`
      + "The inset is declared once and applied once. Where the inliner is drawn it is the "
      + "declaration and the control carries no inline padding of its own; where it is not, the "
      + "control's padding is the inset. A kind that is charged twice reads as a field with a "
      + "deeper inside than its neighbour, in the most visible property a field has.",
    ).toEqual([]);
  });
}
