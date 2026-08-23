/**
 * One kind of measurement, one unit, across the whole system.
 *
 * A length in `rem` is a multiple of the reader's own text size; a length in `px` is not. So the unit
 * is not a spelling choice — it decides whether a measurement follows a person who enlarges their
 * text or stays behind while everything around it moves.
 *
 * **`em` is on the list too, and for a different reason that is worth stating rather than lumping in.**
 * An `em` does not stay still — it is the one unit that tracks the reader's text most closely of all.
 * The reason it is not the unit for these measurements is that it multiplies a size *the theme chose*
 * by a number *the host chose*, so the product depends on two independent decisions and only some of
 * those products land on a whole pixel. `rem` has one decision in it. Saying `em` "stays put" would be
 * arguing something it does not do, and an earlier version of this file's message did exactly that.
 *
 * The rule that makes that checkable is simple and absolute: **each kind of measurement uses exactly
 * one unit everywhere.** Anything that surrounds or contains text — spacing, type size, control
 * height, corner radius — is `rem`, because it has to grow with what it holds or the padding crushes
 * as the type enlarges. A border and a focus ring are `px`, because they are boundaries rather than
 * content: a 1px border at 150% text is a blurred half-pixel, and a ring that scales can overflow the
 * control it belongs to.
 *
 * With the rule stated, `gap: 16px` is not a variation on `gap: 1rem`. It is a violation, and finding
 * it needs no comparison of intent and no argument about which the author meant.
 *
 * **One idiom is excluded, and it is excluded by what it does rather than by its numbers.** A box of
 * one pixel, absolutely positioned, is how an element is taken off the screen while it stays in the
 * accessibility tree — the thing a screen reader reads and nobody sees. Its size is not a measurement
 * of anything; it is as small as it can be without being removed. Every `1px` in this sheet is that,
 * and the exclusion tests for the position rather than trusting the value.
 *
 * @source-inspection — the authored stylesheet **is** the thing under test. A unit is erased by the
 * time a browser computes a length: `1rem` and `16px` both arrive as `16px` at a default root, so a
 * rendered page cannot say which was written, and the distinction this battle is about exists only in
 * the source.
 *
 * Claims under attack: UI-005.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SHEET = join(resolve(HERE, "..", "..", ".."), "packages", "styles", "src", "modyra.css");

/** What each kind of measurement is stated in. */
const UNIT_FOR = {
  rem: /^(gap|row-gap|column-gap|padding|padding-[a-z-]+|margin|margin-[a-z-]+|font-size|height|min-height|max-height|width|min-width|max-width|inline-size|block-size|border-radius|border-[a-z]+-radius)$/,
  px: /^(border-width|border-[a-z]+-width|outline-width|outline-offset)$/,
};

battle(
  {
    claims: ["UI-005"],
    title: "one kind of measurement is stated in one unit",
    environments: ["node"],
  },
  async () => {
    const css = readFileSync(SHEET, "utf8");
    const wrong = new Map();
    let checked = 0;

    // Rule bodies, so a declaration can be read together with the others it sits beside.
    for (const rule of css.matchAll(/\{([^{}]*)\}/g)) {
      const body = rule[1];
      // The visually-hidden idiom, recognised by what it does: an absolutely positioned box shrunk to
      // one pixel is not stating a size, it is getting out of the way while staying readable.
      const hidden = /position:\s*absolute/.test(body) && /(width|height):\s*1px/.test(body);

      for (const declaration of body.matchAll(/([a-z-]+):\s*([^;]+)/g)) {
        const [, property, value] = declaration;
        if (value.includes("var(--")) continue;

        for (const [unit, properties] of Object.entries(UNIT_FOR)) {
          if (!properties.test(property)) continue;
          for (const length of value.matchAll(/(-?[0-9]*\.?[0-9]+)(rem|px|em)\b/g)) {
            const [, amount, written] = length;
            // Zero is the same length in every unit and states nothing.
            if (Number(amount) === 0) continue;
            checked += 1;
            if (written === unit) continue;
            if (hidden && Math.abs(Number(amount)) === 1) continue;
            const key = `${property}: ${amount}${written} (should be ${unit})`;
            wrong.set(key, (wrong.get(key) ?? 0) + 1);
          }
        }
      }
    }

    // A sheet stating no lengths at all would report no violation for the wrong reason.
    expectEqual(checked > 50, true, {
      claimIds: ["UI-005"],
      what: `this sheet states ${checked} length(s) for a measurement whose unit is fixed — too few to `
        + "have measured anything",
    });

    const listed = [...wrong.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([what, times]) => `${what} ×${times}`);

    expectEqual(listed, [], {
      claimIds: ["UI-005"],
      what: `${listed.length} declaration(s) state a measurement in the wrong unit: ${listed.join("; ")}. `
        + "A `px` length stays where it is while everything around it grows for a reader who enlarges "
        + "their text; an `em` moves, but by a factor the host chose on top of a size the theme chose, "
        + "so where it lands is the product of two decisions rather than one",
    });
  },
);
