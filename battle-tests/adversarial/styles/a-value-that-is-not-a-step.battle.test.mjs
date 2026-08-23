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
 * **The exceptions are tight and none of them is a length.** Keywords, zero, percentages, fractions —
 * things that are not measurements or are the same measurement in any scale. A length with no step is
 * not an exception: it means the scale is missing a step, and adding one is a decision somebody makes
 * rather than a number nobody sees.
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
    for (const declaration of readFileSync(SHEET, "utf8").matchAll(/(--mdy-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const [, name, raw] = declaration;
      // A step is allowed to be a number. That is what a step is.
      if (steps.has(name)) continue;
      examined += 1;
      const value = raw.trim();
      if (value.startsWith("var(")) continue;
      if (NOT_A_MEASUREMENT.test(value)) continue;
      // A length, wherever it sits in the value — including inside a shorthand that is otherwise
      // referencing properly, because `1px solid var(…)` still pins the one part a scale should move.
      if (!/(?:^|[\s(])-?[0-9]*\.?[0-9]+(rem|px|em)\b/.test(value)) continue;
      leaks.push(`${name}: ${value}`);
    }

    // The scale that was measured against and the population measured, recorded as the action —
    // both are facts about the sweep rather than about its findings, so this gate can still say what
    // it did on the day the last leak is fixed.
    ctx.log.note("the scale this sheet is measured against", { steps: steps.size });
    ctx.log.note("properties below the scale, read and judged", { examined, leaks: leaks.length });

    expectEqual(leaks, [], {
      claimIds: ["UI-005"],
      what: `${leaks.length} propert(ies) below the scale hold a length instead of a step: `
        + `${leaks.join("; ")}. Each is a literal wearing a token's name, and a theme that moves the `
        + "scale moves everything except these",
    });
  },
);
