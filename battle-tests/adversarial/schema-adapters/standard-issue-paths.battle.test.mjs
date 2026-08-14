/**
 * What a schema library hands the adapter, and what the adapter does with it.
 *
 * `@modyra/standard-schema` is a structural copy of the Standard Schema v1 spec with zero
 * dependencies, which is what lets one adapter serve Zod, Valibot, ArkType and whatever implements
 * the spec next. The cost of that choice is that nothing checks the other side: the copy is a
 * TypeScript interface, and at runtime the adapter reads whatever the library actually returned.
 *
 * `issue.path` is where that matters. The spec types it as an array of keys or `{key}` segments, and
 * the adapter maps over it to build the dotted path an issue is attributed to. A library that emits
 * anything else — a bare string, a number, a `Set` — reaches `.map` on a value that has none.
 *
 * That is a third party's spec violation, but the failure is Modyra's shape: an uncaught `TypeError`
 * out of form-level validation, which runs on construction and again on every write. The form does
 * not report a bad issue and carry on; it stops existing. Everywhere else the engine treats
 * untrusted ingress this way — an invalid RegExp source, a hostile field name, a draft of the wrong
 * shape — it reports and skips.
 *
 * The battle asserts the whole shape space rather than one value, because the boundary is what a
 * fix has to hold: the two spec-legal forms must keep attributing, the empty and absent forms must
 * stay form-level, and the malformed ones must not take the form with them.
 */

import { createStandardForm } from "@modyra/standard-schema";
import { field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A Standard Schema v1 whose single issue carries whatever path a battle wants to try. */
function schemaReporting(path) {
  return {
    "~standard": {
      version: 1,
      vendor: "battle",
      validate: () => ({ issues: [{ message: "reported", path }] }),
    },
  };
}

/** Build a form on that schema, reporting how it went rather than letting a throw escape. */
function formOn(schema) {
  try {
    const form = createStandardForm(schema, { name: field("") }, { devWarnings: false });
    const attributed = form.errorsFor("name")().map((each) => each.message);
    form.destroy();
    return { built: true, attributed };
  } catch (error) {
    return { built: false, error: `${error.constructor.name}: ${error.message}` };
  }
}

battle(
  {
    claims: ["SCH-001"],
    title: "an issue reaches the field it names, whichever way the library spells the path",
    environments: ["node"],
  },
  async (ctx) => {
    // The two forms the spec allows. Both name the same field and both must attribute to it, or an
    // adapter that serves one library silently drops findings from another.
    for (const [label, path] of [["keys", ["name"]], ["segments", [{ key: "name" }]]]) {
      const outcome = formOn(schemaReporting(path));
      ctx.log.note("a spec-legal path", { label, outcome });

      expectEqual(outcome.attributed, ["reported"], {
        claimIds: ["SCH-001"],
        what: `an issue written with ${label} did not reach the field it names`,
        detail: JSON.stringify(outcome),
      });
    }

    // An issue about the form rather than a field belongs to no field. Attributing it to one would
    // put a message under an input the user cannot act on.
    for (const [label, path] of [["empty", []], ["absent", undefined], ["null", null]]) {
      const outcome = formOn(schemaReporting(path));
      ctx.log.note("a path naming no field", { label, outcome });

      expectEqual(outcome.attributed, [], {
        claimIds: ["SCH-001"],
        what: `an issue with ${label} path was attributed to a field it does not name`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);

battle(
  {
    claims: ["SCH-001"],
    title: "a library that breaks the spec is reported, not allowed to take the form down",
    environments: ["node"],
  },
  async (ctx) => {
    // Values a library could return that the spec does not allow. Modyra cannot make them correct,
    // but the question is what a consumer sees: a form missing one message, or no form at all.
    for (const [label, path] of [
      ["a bare string", "name"],
      ["a number", 3],
      ["a single segment object", { key: "name" }],
      ["a Set", new Set(["name"])],
    ]) {
      const outcome = formOn(schemaReporting(path));
      ctx.log.note("a path shape the spec does not allow", { label, outcome });

      expectClaim(outcome.built === true, {
        claimIds: ["SCH-001"],
        what: `${label} as an issue path took the whole form down instead of being reported`,
        detail: JSON.stringify(outcome),
      });
    }

    // The control: a well-formed schema through the same helper builds and attributes, so a failure
    // above is the path shape rather than this battle's fixture.
    const control = formOn(schemaReporting(["name"]));
    expectClaim(control.built === true && control.attributed.length === 1, {
      claimIds: ["SCH-001"],
      what: "the control schema did not build, so the assertions above measure nothing",
      detail: JSON.stringify(control),
    });
  },
);
