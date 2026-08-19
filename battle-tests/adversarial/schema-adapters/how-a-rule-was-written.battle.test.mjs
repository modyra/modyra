/**
 * The same rule, written the two ways the schema library offers, seeding two different forms.
 *
 * ADR 0086 settles what a derived field starts from: the empty its own schema accepts, so
 * `z.string().min(1)` starts at `""` and says *Too small* both at the first paint and at submission
 * — one message, the author's, at both moments. A kind with no empty of its own starts at `null`.
 *
 * A schema library offers two ways to say the same constraint. `.min(2)` is a check on the string
 * type; `.refine(fn, "message")` is an arbitrary predicate with the author's own wording, which is
 * the one reached for whenever the rule is not one of the library's built-ins — a consent box that
 * must be ticked, a code that must match a checksum, a list that must contain a particular member.
 *
 * The seed is not supposed to know the difference. It is a property of the **kind**: a string starts
 * at the empty string whatever is later asserted about it. Measured, it does know:
 *
 *   z.string()                    ""     —
 *   z.string().min(2)             ""     "Too small: expected string to have >=2 characters"
 *   z.string().refine(…)          null   "Invalid input: expected string, received null"
 *   z.boolean()                   false  —
 *   z.boolean().refine(…)         null   "Invalid input: expected boolean, received null"
 *   z.array(z.string())           []     —
 *   z.array(z.string()).min(1)    []     "Too small: expected array to have >=1 items"
 *   z.array(z.string()).refine(…) []     "pick one"        ← the author's message, correctly
 *
 * Two costs, and the second is the one a user meets. The seed moves because of how the rule was
 * spelled rather than what it says. And the message the author wrote never arrives: the value is of
 * the wrong type, so the predicate carrying their wording is never reached, and the person is shown
 * a type error about a value they did not enter. `array` proves this is not a limit of introspection
 * under a refinement — it keeps its seed and delivers the author's message.
 */

import { createZodForm } from "@modyra/zod";
import { z } from "zod";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A kind, and the same constraint said as a built-in check and as a refinement. */
const KINDS = Object.freeze([
  {
    name: "string",
    base: () => z.string(),
    checked: () => z.string().min(2),
    refined: () => z.string().refine((value) => value.length >= 2, "the author's own words"),
  },
  {
    name: "boolean",
    base: () => z.boolean(),
    checked: null, // a boolean has no built-in check; the refinement is the only way to say it
    refined: () => z.boolean().refine((value) => value === true, "the author's own words"),
  },
  {
    name: "array",
    base: () => z.array(z.string()),
    checked: () => z.array(z.string()).min(1),
    refined: () => z.array(z.string()).refine((value) => value.length >= 1, "the author's own words"),
  },
]);

/** What a form derived from a one-field schema starts at, and what it says about that start. */
function derive(leaf) {
  const form = createZodForm(z.object({ x: leaf }), { devWarnings: false });
  try {
    return {
      seed: form.getValue().x,
      messages: form.errorsFor("x")().map((each) => each.message),
    };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["SCH-001"],
    title: "how a rule was written does not decide where the field starts",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = KINDS.map((kind) => ({
      kind: kind.name,
      base: derive(kind.base()),
      checked: kind.checked ? derive(kind.checked()) : null,
      refined: derive(kind.refined()),
    }));
    ctx.log.note("where each kind starts, by how its rule was spelled", observed);

    // The instrument answers first. If no kind had an empty of its own, every seed would be `null`
    // and agreement would mean the battle attacked nothing.
    expectClaim(observed.filter((row) => row.base.seed !== null).length >= 2, {
      claimIds: ["SCH-001"],
      what: "no kind here starts anywhere but null, so the battle has nothing to compare",
      detail: JSON.stringify(observed.map((row) => ({ kind: row.kind, seed: row.base.seed }))),
    });

    const moved = observed.flatMap((row) => {
      const spellings = [
        ["checked", row.checked],
        ["refined", row.refined],
      ].filter(([, seen]) => seen !== null);
      return spellings.flatMap(([spelling, seen]) =>
        Object.is(seen.seed, row.base.seed)
          ? []
          : [{ kind: row.kind, spelling, base: row.base.seed, seen: seen.seed }],
      );
    });

    expectEqual(moved, [], {
      claimIds: ["SCH-001"],
      what: "a field starts somewhere else because of how its rule was spelled, not because of the kind it is",
    });

    // And the consequence a person meets: the wording the author chose is what the form says. A
    // seed of the wrong type never reaches the predicate that carries it.
    const silenced = observed.flatMap((row) =>
      row.refined.messages.some((message) => message.includes("the author's own words"))
        ? []
        : [{ kind: row.kind, said: row.refined.messages }],
    );

    expectEqual(silenced, [], {
      claimIds: ["SCH-001"],
      what: "a refinement's message never reached the user, who was shown a type error about a value they did not enter",
    });
  },
);
