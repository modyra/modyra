/**
 * The same size, written in two units that stop agreeing when a reader changes their text.
 *
 * A stylesheet states sizes in `rem` and in `px`. At a browser's default they are interchangeable —
 * `1rem` and `16px` are the same sixteen pixels — so a sheet can carry both for years and look
 * perfectly consistent to everyone who wrote it.
 *
 * They are not interchangeable. `rem` is a multiple of the reader's own text size and `px` is not, so
 * a person who enlarges their text moves everything stated in `rem` and nothing stated in `px`. Two
 * gaps that were equal become unequal, a control sized in one unit outgrows the box sized in the
 * other, and the layout that was coherent at 100% comes apart at 150% — for the readers who need it
 * most and for nobody who tested it.
 *
 * **The defect is the mixture, not either unit.** A sheet written entirely in `px` is a different
 * argument, with its own answer; a sheet written entirely in `rem` scales as one thing. What cannot
 * be right is the same property, doing the same job, expressed both ways — because then the two
 * halves of one layout disagree about what a size means.
 *
 * So this compares values rather than counting units: a `px` length is converted at the default
 * sixteen and reported only when the sheet **also** states that exact size in `rem` somewhere. Two
 * spellings of one number is the evidence; a `px` value nothing else duplicates may be a deliberate
 * hairline and is not this defect.
 *
 * Properties that a reader's text size should move are the ones checked. A border width, a shadow
 * offset and an image size are left out on purpose: those are not text and do not have to grow with
 * it.
 *
 * **No claim in the register covers text resizing.** This cites the visual-consistency one because
 * that is what a mixture breaks first, and the gap is worth saying out loud: nothing in this suite has
 * ever promised that a layout survives a reader enlarging their text, so nothing was ever going to
 * catch a sheet drifting away from it. A promise nobody made is not a promise anybody keeps.
 *
 * @source-inspection — the authored stylesheet **is** the thing under test. A unit is erased by the
 * time a browser computes a length: `1rem` and `16px` both arrive as `16px` at a default root, so a
 * rendered page cannot say which was written. The distinction this battle is about exists only in the
 * source, and reading anything else would measure the browser's arithmetic rather than the sheet's
 * choice.
 *
 * Claims under attack: UI-005.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SHEET = join(resolve(HERE, "..", "..", ".."), "packages", "styles", "src", "modyra.css");

/** What a reader enlarging their text expects to move with it. */
const SCALES_WITH_TEXT = /^(gap|row-gap|column-gap|padding|padding-[a-z-]+|margin|margin-[a-z-]+|font-size|height|min-height|width|min-width|max-width|inline-size|block-size|line-height)$/;

/** The root size a browser uses unless a reader has said otherwise. */
const DEFAULT_ROOT = 16;

battle(
  {
    claims: ["UI-005"],
    title: "one size is not written in two units",
    environments: ["node"],
  },
  async (ctx) => {
    const css = readFileSync(SHEET, "utf8");

    /** Every length this sheet states for a property that should follow the reader's text. */
    const inRem = new Map();
    const inPx = new Map();

    for (const match of css.matchAll(/([a-z-]+):\s*([^;{}]+);/g)) {
      const [, property, value] = match;
      if (!SCALES_WITH_TEXT.test(property)) continue;
      if (value.includes("var(--")) continue;

      for (const length of value.matchAll(/(-?[0-9]*\.?[0-9]+)(rem|px)\b/g)) {
        const [, amount, unit] = length;
        const pixels = unit === "rem" ? Number(amount) * DEFAULT_ROOT : Number(amount);
        // Zero is the same in both units and says nothing about intent.
        if (pixels === 0) continue;
        const into = unit === "rem" ? inRem : inPx;
        into.set(pixels, (into.get(pixels) ?? 0) + 1);
      }
    }

    // What this battle did is read both populations, which is true of a clean sheet as much as of a
    // mixed one. Recording it here rather than beside each finding is what lets the gate report
    // "scanned, found nothing" instead of failing as an empty battle once the mixture is gone.
    for (const [unit, sizes] of [["rem", inRem], ["px", inPx]]) {
      const stated = [...sizes.values()].reduce((sum, times) => sum + times, 0);
      ctx.log.note("sizes read in one unit", { unit, distinct: sizes.size, stated });
    }

    // A sheet stating nothing in either unit would report no mixture for the wrong reason.
    expectEqual(inRem.size > 0 && inPx.size > 0, true, {
      claimIds: ["UI-005"],
      what: `this sheet states ${inRem.size} distinct rem length(s) and ${inPx.size} px — with none of one, `
        + "a mixture cannot occur and this battle has measured nothing",
    });

    const bothWays = [...inPx.entries()]
      .filter(([pixels]) => inRem.has(pixels))
      .map(([pixels, times]) =>
        `${pixels}px (${times}×) is also written ${pixels / DEFAULT_ROOT}rem (${inRem.get(pixels)}×)`);

    expectEqual(bothWays, [], {
      claimIds: ["UI-005"],
      what: `${bothWays.length} size(s) are written both ways: ${bothWays.join("; ")}. They are equal at `
        + "a default text size and unequal at every other, so a reader who enlarges their text gets a "
        + "layout whose halves disagree about what a size means",
    });
  },
);
