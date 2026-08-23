/**
 * Where a number is allowed to be, and where it is a leak.
 *
 * The system is three tiers. **Tier one is the scale** — the steps, and the only place in the library
 * where a length is a number. **Tier two is semantic** — what a field's gap is, in terms of a step.
 * **Tier three is the component** — what a chip's gap is, in terms of the semantic one. Every value
 * above tier one is a reference.
 *
 * The rule is one line and it is what makes the whole arrangement hold: **below tier one, a custom
 * property's value begins with `var(`.** A property holding a length instead has left the system —
 * not visibly, and not in a way anything notices, because it still looks like a token and is still
 * read like one. It is a literal wearing a token's name.
 *
 * That matters more than a literal in a declaration, which at least announces itself. A token whose
 * value is a number **cannot be moved by changing the scale**: a theme that shifts every step down
 * moves everything except the properties that never referenced a step, and the result is a layout
 * that is coherent everywhere the theme reached and wrong where it did not.
 *
 * **The exceptions are tight and one of them is a length.** Keywords, zero, percentages and fractions
 * are not measurements, or are the same measurement in any scale. A length with no step is not an
 * exception: it means the scale is missing a step, and adding one is a decision somebody makes rather
 * than a number nobody sees.
 *
 * **The length that is exempt is a coefficient: one multiplied by a unitless token.** A density ramp
 * is written `calc(0.125rem + (var(--density) * 0.03125rem))`, and that last number is not a size —
 * it is a *rate*, rem per notch of the ramp. The vocabulary rule that governs this whole system says
 * each kind of measurement gets its own scale, and a rate is a different kind from a length however
 * it is spelled. Half a pixel is not a step; putting it on the scale to satisfy a check would corrupt
 * the scale, which is the migration eating its own reason.
 *
 * That a coefficient sometimes equals a step is a coincidence and not a reason to demand it be
 * written as one — `var(--density) * 0.25rem` reads the same as `space-1` and means something else.
 *
 * **Everything the arithmetic adds or subtracts is still reported.** That is the narrow half of a
 * wider exemption — skip any value containing `calc` over a token — which does not survive
 * measurement: it would also hide `0.5rem` and `1.25rem`, which are *added to* and *subtracted from*
 * a token and which the scale already declares, as `space-2` and `size-5`. Those are steps written as
 * numbers, wearing a `var()` elsewhere in the same expression as cover. A literal inside arithmetic
 * is harder to find than one standing alone, which is a reason to keep reporting it rather than to
 * stop.
 *
 * Tier one is discovered by reading the scale rather than by matching names, so a step added there is
 * immediately allowed to hold a number and a property renamed into looking like a step is not.
 *
 * @source-inspection — a custom property's *declared* value is the thing under test. By the time a
 * browser resolves it, a step and a literal that happen to be equal are the same computed number, and
 * the difference this battle is about — whether a value can be moved by moving the scale — exists
 * only in the source.
 *
 * Claims under attack: UI-005.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const STYLES = join(resolve(HERE, "..", "..", ".."), "packages", "styles", "src");
const SCALE = join(STYLES, "modyra-scale.css");
const SHEET = join(STYLES, "modyra.css");

/** Values that are not measurements, or are the same one in every scale. */
const NOT_A_MEASUREMENT = /^(auto|none|inherit|initial|unset|revert|transparent|currentcolor|0|[0-9]+%|[0-9]+fr)$/i;

battle(
  {
    claims: ["UI-005"],
    title: "a token below the scale holds a step, not a number",
    environments: ["node"],
  },
  async (ctx) => {
    // Without a scale there is no tier one, and every property would read as a leak from a system
    // that does not exist yet. Say that rather than report 206 findings.
    expectEqual(existsSync(SCALE), true, {
      claimIds: ["UI-005"],
      what: "there is no scale file, so there is no tier one for anything to reference and this battle "
        + "has nothing to measure",
    });

    const steps = new Set(
      [...readFileSync(SCALE, "utf8").matchAll(/(--mdy-[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
    );
    expectEqual(steps.size > 8, true, {
      claimIds: ["UI-005"],
      what: `the scale declares ${steps.size} step(s) — too few to be the scale this battle assumes`,
    });

    const leaks = [];
    /** Properties below the scale that were read and judged, leak or not. */
    let examined = 0;
    /** Lengths passed over because the sheet multiplies them by a unitless token. */
    let coefficients = 0;
    for (const declaration of readFileSync(SHEET, "utf8").matchAll(/(--mdy-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const [, name, raw] = declaration;
      // A step is allowed to be a number. That is what a step is.
      if (steps.has(name)) continue;
      examined += 1;
      const value = raw.trim();
      if (value.startsWith("var(")) continue;
      if (NOT_A_MEASUREMENT.test(value)) continue;

      // Every length in the value, wherever it sits — including inside a shorthand that is otherwise
      // referencing properly, because `1px solid var(…)` still pins the one part a scale should move.
      for (const length of value.matchAll(/(?:^|[\s(*/+-])(-?[0-9]*\.?[0-9]+(?:rem|px|em))\b/g)) {
        const literal = length[1];
        if (Number.parseFloat(literal) === 0) continue;
        // The slope of a ramp rather than a size: `var(--density) * 0.5px` turns a value as the ramp
        // turns. Recognised by the multiplication, so a number merely sitting near one is not excused.
        const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`var\\([^)]*\\)\\s*\\*\\s*${escaped}|${escaped}\\s*\\*\\s*var\\(`).test(value)) {
          coefficients += 1;
          continue;
        }
        leaks.push(`${name}: ${literal}${value === literal ? "" : ` in \`${value}\``}`);
      }
    }

    // The scale that was measured against and the population measured, recorded as the action —
    // both are facts about the sweep rather than about its findings, so this gate can still say what
    // it did on the day the last leak is fixed.
    ctx.log.note("the scale this sheet is measured against", { steps: steps.size });
    ctx.log.note("properties below the scale, read and judged", { examined, leaks: leaks.length });
    ctx.log.note("lengths passed over as a ramp's slope", { coefficients });

    expectEqual(leaks, [], {
      claimIds: ["UI-005"],
      what: `${leaks.length} length(s) below the scale are written as a number instead of a step: `
        + `${leaks.join("; ")}. Each is a literal wearing a token's name, and a theme that moves the `
        + "scale moves everything except these. A number inside arithmetic counts: the surrounding "
        + "`var()` moves with the scale and the number does not, so the expression's result is part "
        + "system and part fixed",
    });
  },
);
