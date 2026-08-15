/**
 * One pattern in a document, two meanings by the time it reaches a person.
 *
 * A document's `validators.pattern` is a string. The engine compiles it into a `RegExp` and runs
 * `test`, which looks for a match *anywhere* in the value. It also projects it as the control's
 * `pattern` attribute, and HTML anchors that implicitly: the attribute matches only if the *whole*
 * value does. The same string, two rules.
 *
 * For an anchored source they agree, which is the control here. For an ordinary unanchored one —
 * `[0-9]{3}`, meaning "has three digits in it" to anyone who has written a regular expression —
 * they do not:
 *
 *     form:    "ab123cd" accepted
 *     browser: "ab123cd" refused, `input.validity.patternMismatch`
 *
 * The typed-forms guide's line is "an attribute constrains typing, never the model". Here it
 * constrains beyond the model: the control matches `:invalid` and carries the browser's own
 * "Please match the requested format." while the form reports no error and tells assistive technology
 * `aria-invalid="false"`. Put that control inside a `<form>` and native validation refuses a
 * submission the library considers ready, with a message the library never wrote and cannot localise.
 *
 * The invariant is one-directional on purpose: whatever the attribute is, it must not refuse a value
 * the form accepts. Projecting nothing for an unanchored source passes. Projecting a form of it that
 * means the same thing under HTML's anchoring passes. Only an attribute that is stricter than the
 * rule it came from is red.
 */

import { buildDynamicValidators, factsOfAll } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Patterns a document might carry, anchored and not. */
const SOURCES = Object.freeze([
  { source: "^a+$", anchored: true },
  { source: "^[0-9]{3}$", anchored: true },
  { source: "a+", anchored: false },
  { source: "[0-9]{3}", anchored: false },
  { source: "\\d{3}", anchored: false },
]);

/** Values a person might type. */
const TYPED = Object.freeze(["xax", "aaa", "ab123cd", "123", ""]);

/** Whether the form's own rules accept `value`. */
function formAccepts(source, value) {
  const { validators } = buildDynamicValidators({ pattern: source });
  return validators.flatMap((run) => run(value)).length === 0;
}

/**
 * Whether the projected attribute accepts `value`, in the browser's terms.
 *
 * HTML anchors a `pattern` implicitly, so the attribute's meaning is the source wrapped whole — and
 * it is not evaluated at all on an empty value, which is the same boundary the engine draws:
 * emptiness is `required`'s question. The control battle below found that omission in a first
 * version of this model rather than reporting it as a defect in the engine.
 */
function attributeAccepts(projected, value) {
  if (projected === null || projected === undefined) return true;
  if (value === "") return true;
  return new RegExp(`^(?:${projected})$`).test(value);
}

battle(
  {
    claims: ["VAL-004", "DYN-001"],
    title: "a pattern the control carries refuses nothing the form accepts",
    environments: ["node"],
  },
  async (ctx) => {
    const disagreed = [];
    const projections = [];

    for (const { source, anchored } of SOURCES) {
      const { validators } = buildDynamicValidators({ pattern: source });
      const projected = factsOfAll(validators).constraints.pattern ?? null;
      projections.push({ source, anchored, projected });

      for (const value of TYPED) {
        const form = formAccepts(source, value);
        const attribute = attributeAccepts(projected, value);
        if (form && !attribute) disagreed.push({ source, value, formAccepts: form, attributeAccepts: attribute });
      }
    }
    ctx.log.note("what each pattern projects", { projections, disagreed });

    // The premise: something is projected at all. A build that stopped projecting patterns entirely
    // would satisfy the invariant by carrying no attribute, and that is a legitimate repair — but it
    // must be visible as such rather than read as agreement.
    const carried = projections.filter((each) => each.projected !== null);
    ctx.log.note("patterns that reach a control", { carried: carried.length, of: projections.length });

    // The control: an anchored source agrees with its own projection on every value, so a
    // disagreement below is the anchoring rather than this battle's model of what a browser does.
    for (const { source, anchored } of SOURCES.filter((each) => each.anchored)) {
      const projected = factsOfAll(buildDynamicValidators({ pattern: source }).validators).constraints.pattern ?? null;
      for (const value of TYPED) {
        expectEqual(attributeAccepts(projected, value), formAccepts(source, value), {
          claimIds: ["VAL-004"],
          what: `an anchored pattern ${source} and its projection disagreed about ${JSON.stringify(value)}, so this battle's model of the attribute is wrong`,
          detail: JSON.stringify({ anchored, projected }),
        });
      }
    }

    expectEqual(disagreed, [], {
      claimIds: ["VAL-004", "DYN-001"],
      what: "a control refuses a value the form accepts, because its pattern attribute is anchored and the rule it came from is not",
    });
  },
);
