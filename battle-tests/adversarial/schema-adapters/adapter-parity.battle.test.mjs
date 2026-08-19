/**
 * One schema, two adapters, and the one difference between them that is a decision.
 *
 * A Zod schema can be reached two ways. `@modyra/zod` introspects it and builds the field tree
 * itself; `@modyra/standard-schema` cannot — the spec standardises validation and publishes no
 * introspection API — so the tree is declared and the schema validates the whole value. Zod ≥3.24
 * implements Standard Schema, so the same object can go through either, and a consumer choosing
 * between them is entitled to the same verdicts.
 *
 * They agree exactly on everything a user does: the same messages, attributed to the same dotted
 * paths, at the same moment, with the same value underneath. That is worth pinning because the two
 * arrive by different routes — one walks the schema's shape, the other walks its issues — and a
 * change to either could quietly make a form say something different depending on which import a
 * project happened to pick.
 *
 * Where they differ is before the user has done anything, and it follows from the same asymmetry.
 * Introspection reads the kind, so a derived field starts at the empty its own kind accepts and
 * `null` where the kind has none (ADR 0086); a declared tree starts at whatever the consumer
 * declared, which introspection has no way to know. Both then report against the schema honestly
 * from where they start. Naming that here is what keeps it from being read as a divergence and
 * "fixed" into one.
 *
 * So the seed is not pinned as a constant, which would only record whichever value shipped. It is
 * measured against the kind itself: the field starts where a bare leaf of that kind starts, and that
 * is a property the decision states rather than a number this file remembers.
 */

import { createStandardForm } from "@modyra/standard-schema";
import { createZodForm } from "@modyra/zod";
import { field, group } from "@modyra/core";
import { z } from "zod";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** One schema, with a nested field so path attribution has something to get wrong. */
const SCHEMA = z.object({
  name: z.string().min(2),
  inner: z.object({ age: z.number().min(18) }),
});

/** The declared tree the standard adapter needs, starting where the derived one does not. */
const declared = () => ({ name: field(""), inner: group({ age: field(0) }) });

/** Everything a consumer can observe, from the two paths a form is asked about. */
function observe(form) {
  return {
    valid: form.state.valid(),
    value: form.getValue(),
    name: form.errorsFor("name")().map((each) => each.message),
    age: form.errorsFor("inner.age")().map((each) => each.message),
  };
}

battle(
  {
    claims: ["SCH-001", "DYN-001"],
    title: "the same schema reached two ways answers the same way",
    environments: ["node"],
  },
  async (ctx) => {
    const derived = createZodForm(SCHEMA, { devWarnings: false });
    const given = createStandardForm(SCHEMA, declared(), { devWarnings: false });

    try {
      // Both wrong, in both fields, at the same time.
      derived.f.name.set("x");
      given.f.name.set("x");
      derived.f.inner.age.set(10);
      given.f.inner.age.set(10);

      const wrong = [observe(derived), observe(given)];
      ctx.log.note("the same two values through both adapters", { derived: wrong[0], given: wrong[1] });

      // The control: something is actually wrong, so agreeing is agreeing about a verdict rather
      // than about silence.
      expectClaim(wrong[0].name.length > 0 && wrong[0].age.length > 0, {
        claimIds: ["SCH-001"],
        what: "neither field reported anything, so the comparison below is between two empty answers",
        detail: JSON.stringify(wrong[0]),
      });

      expectEqual(wrong[1], wrong[0], {
        claimIds: ["SCH-001", "DYN-001"],
        what: "the same schema gave different answers depending on which adapter reached it",
        detail: JSON.stringify(wrong),
      });

      // And both right.
      derived.f.name.set("okay");
      given.f.name.set("okay");
      derived.f.inner.age.set(30);
      given.f.inner.age.set(30);

      const right = [observe(derived), observe(given)];
      ctx.log.note("the same satisfied values through both adapters", { derived: right[0], given: right[1] });

      expectEqual(right[1], right[0], {
        claimIds: ["SCH-001", "DYN-001"],
        what: "the adapters disagreed about a value that satisfies the schema",
        detail: JSON.stringify(right),
      });

      expectClaim(right[0].valid === true, {
        claimIds: ["SCH-001"],
        what: "a value satisfying the schema left the form invalid, so agreement above is agreement about a wrong answer",
        detail: JSON.stringify(right[0]),
      });
    } finally {
      derived.destroy();
      given.destroy();
    }
  },
);

battle(
  {
    claims: ["SCH-001"],
    title: "a derived tree starts at its kind's empty and a declared one where it was declared",
    environments: ["node"],
  },
  async (ctx) => {
    const derived = createZodForm(SCHEMA, { devWarnings: false });
    const given = createStandardForm(SCHEMA, declared(), { devWarnings: false });

    // The oracle, measured rather than remembered: where a bare leaf of each kind starts. Comparing
    // the derived tree against these instead of against a literal is what keeps this battle from
    // ratifying whichever seed happens to ship.
    const bare = createZodForm(z.object({ name: z.string(), age: z.number() }), { devWarnings: false });
    const kindStart = bare.getValue();
    bare.destroy();

    try {
      const start = { derived: observe(derived), given: observe(given) };
      ctx.log.note("what each adapter's form holds before the user does anything", {
        ...start,
        kindStart,
      });

      // Introspection reads the kind, so a derived field starts at that kind's own empty — and the
      // constraints written on top of it do not move it. This is the difference from a declared
      // tree, and it is named so it is not read as a divergence and made to agree.
      expectEqual(
        start.derived.value,
        { name: kindStart.name, inner: { age: kindStart.age } },
        {
          claimIds: ["SCH-001"],
          what: "a derived field does not start where its own kind starts, so the constraints on it moved the seed",
          detail: JSON.stringify({ derived: start.derived.value, kindStart }),
        },
      );

      expectEqual(start.given.value, { name: "", inner: { age: 0 } }, {
        claimIds: ["SCH-001"],
        what: "a declared tree did not start at what was declared",
        detail: JSON.stringify(start.given.value),
      });

      // Both report against the schema honestly from where they start, which is what makes the
      // difference an initial value rather than a difference in how the schema is read.
      expectClaim(start.derived.valid === false && start.given.valid === false, {
        claimIds: ["SCH-001"],
        what: "a form starting at a value the schema refuses reported itself valid",
        detail: JSON.stringify(start),
      });

      expectClaim(start.derived.name.length > 0 && start.given.name.length > 0, {
        claimIds: ["SCH-001"],
        what: "one adapter said nothing about a starting value its schema refuses",
        detail: JSON.stringify(start),
      });
    } finally {
      derived.destroy();
      given.destroy();
    }
  },
);
