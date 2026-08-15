/**
 * The doors that take a schema, and what they say when they are not given one.
 *
 * ADR 0057 is called "an argument is refused where it arrives", and it hardened seven entry points
 * for a reason it states plainly: a value that cannot be used should be refused at the call rather
 * than left to damage the form and fail later. Every one of those seven is a *setter*.
 *
 * The doors that take a schema were not among them, and they are the first door a consumer touches.
 * Given something that is not a schema they do one of two things, and neither is a refusal:
 *
 *   - raise a `TypeError` from inside JavaScript, naming no argument and no call, so three different
 *     mistakes are indistinguishable from each other and from a bug in the library;
 *   - or build a form with no fields at all, silently, which reports itself valid and submittable.
 *
 * The second is the worse of the two, and it is the one ADR 0057's own reasoning is about: a form
 * that cannot be read is worse in production than a thrown error the caller can see.
 *
 * The control is that a real schema builds a real form, so what is asserted is the argument rather
 * than the doors being shut.
 */

import { buildDynamicFormSchema, buildFlatFormSchema, createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Things a caller might pass by mistake, none of which is a schema. */
const NOT_SCHEMAS = Object.freeze([
  ["an array", [1, 2]],
  ["a string", "nope"],
  ["a number", 42],
  ["null", null],
  ["undefined", undefined],
  ["a boolean", true],
]);

/** Run one door and report what a consumer would see. */
function knock(run, value) {
  try {
    return { kind: "built", detail: run(value) };
  } catch (error) {
    return {
      kind: error?.constructor?.name ?? "unknown",
      detail: String(error?.message ?? error),
    };
  }
}

const DOORS = Object.freeze([
  ["createForm", (value) => {
    const form = createForm(value, { devWarnings: false });
    const names = form.fieldNames();
    const submittable = form.state.canSubmit();
    form.destroy();
    return { names, submittable };
  }],
  ["buildFlatFormSchema", (value) => Object.keys(buildFlatFormSchema(value))],
  ["buildDynamicFormSchema", (value) => Object.keys(buildDynamicFormSchema(value))],
]);

battle(
  {
    claims: ["API-001", "SEC-001"],
    title: "a door that takes a schema refuses what is not one, by name",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a real schema builds a real form through the door under test.
    const real = createForm({ a: field("x") }, { devWarnings: false });
    const built = { names: real.fieldNames(), value: real.getValue() };
    real.destroy();
    ctx.log.note("the door working", built);

    expectEqual(built, { names: ["a"], value: { a: "x" } }, {
      claimIds: ["API-001"],
      what: "a real schema did not build a form, so nothing below is about the argument",
    });

    const seen = [];
    for (const [door, run] of DOORS) {
      for (const [what, value] of NOT_SCHEMAS) {
        const outcome = knock(run, value);
        seen.push({ door, what, ...outcome });
      }
    }
    ctx.log.note("every schema door, given something that is not a schema", { seen });

    // A refusal is a message this library wrote. A `TypeError` from inside JavaScript is not one:
    // it names no argument, and the same text answers for three different mistakes.
    const internals = seen.filter(
      (each) => each.kind !== "built" && !String(each.detail).includes("[modyra]"),
    );
    expectEqual(internals, [], {
      claimIds: ["API-001"],
      what: "a schema door raised a JavaScript internal instead of refusing the argument by name",
      detail: JSON.stringify(internals.map((each) => `${each.door}(${each.what}): ${each.detail}`)),
    });

    // And the quieter half: a door that builds something out of a value that is not a schema. A form
    // with no fields reports itself submittable, which is the state ADR 0057 exists to prevent.
    const silent = seen.filter((each) => each.kind === "built");
    expectEqual(silent, [], {
      claimIds: ["SEC-001", "API-001"],
      what: "a schema door built a form out of a value that is not a schema",
      detail: JSON.stringify(silent.map((each) => `${each.door}(${each.what}) → ${JSON.stringify(each.detail)}`)),
    });
  },
);
