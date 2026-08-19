/**
 * The seed a derived leaf starts at, against the piece that derived it.
 *
 * ADR 0086 states the rule: *"The initial value of a derived leaf is an empty its own piece
 * accepts"*, chosen in order — first *"what the piece parses `undefined` into — a default or an
 * optional, unchanged"*, then `null` where the piece accepts it, then `""`, then `false`, then `null`
 * for a piece with no representation for empty at all.
 *
 * Steps one, two and three hold: `z.string()` starts at `""`, `z.string().default("d")` at `"d"`,
 * `z.string().nullable()` at `null`, and each piece accepts what it was given. That is the control,
 * and it is what makes the rest specific.
 *
 * An **optional** piece is step one's other half, and it lands on step five. `z.string().optional()`
 * parses `undefined` into `undefined`; the derived descriptor carries `initial: null`; and `null` is
 * the one value `.optional()` refuses — `undefined` and `""` both pass it.
 *
 * Nothing in the form says so. A schema whose fields are all optional has nothing to require, so the
 * form reports `valid: true` from the moment it exists, holding a value the schema it was built from
 * rejects once per field. The consumer's natural last step before sending — parse the value with the
 * schema that describes it — throws on a form the library called ready.
 *
 * Green either way: the seed is one the piece accepts, or the form does not call itself valid while
 * holding one it does not.
 */

import { z } from "zod";

import { buildZodTree } from "@modyra/zod";
import { createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What one piece seeds, and whether the piece takes it back. */
function seedOf(piece) {
  const form = createForm(buildZodTree(z.object({ f: piece })), { devWarnings: false });
  const seed = form.getValue().f;
  form.destroy();
  return { seed, accepted: piece.safeParse(seed).success };
}

battle(
  {
    claims: ["SCH-002"],
    title: "a derived leaf starts at an empty its own piece accepts",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the three steps that do not involve an optional, so a failure below is about the
    // optional rather than about the rule being unimplemented.
    const settled = {
      "a plain string": seedOf(z.string()),
      "a string with a default": seedOf(z.string().default("d")),
      "a nullable string": seedOf(z.string().nullable()),
      "a boolean": seedOf(z.boolean()),
      "a list": seedOf(z.array(z.string())),
    };
    ctx.log.note("the steps that hold", settled);
    expectClaim(Object.values(settled).every((each) => each.accepted), {
      claimIds: ["SCH-002"],
      what: "a leaf with an obvious empty already starts at one its piece refuses, so this battle is not about optionals",
      detail: JSON.stringify(settled),
    });

    const optional = {
      "an optional string": seedOf(z.string().optional()),
      "an optional number": seedOf(z.number().optional()),
      "an optional boolean": seedOf(z.boolean().optional()),
      "an optional enum": seedOf(z.enum(["gold", "silver"]).optional()),
    };
    ctx.log.note("what an optional piece is seeded with", optional);

    const refused = Object.entries(optional)
      .filter(([, each]) => !each.accepted)
      .map(([what, each]) => ({ what, seed: each.seed }));

    expectEqual(refused, [], {
      claimIds: ["SCH-002"],
      what: "a derived leaf starts at a value its own piece refuses, so the form begins holding something the schema does not describe",
    });
  },
);

battle(
  {
    claims: ["SCH-002"],
    title: "a form the library calls valid holds a value its own schema accepts",
    environments: ["node"],
  },
  async (ctx) => {
    // Nothing here is required, so the form has nothing to object to and says so.
    const schema = z.object({
      note: z.string().optional(),
      count: z.number().optional(),
      agreed: z.boolean().optional(),
      tier: z.enum(["gold", "silver"]).optional(),
    });
    const form = createForm(buildZodTree(schema), { devWarnings: false });
    try {
      const value = form.getValue();
      const parsed = schema.safeParse(value);
      ctx.log.note("what the form says and what the schema says", {
        valid: form.state.valid(),
        value,
        accepted: parsed.success,
        issues: parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.code}`),
      });

      // The premise: the form is ready, which is what makes the parse the consumer's next step.
      expectClaim(form.state.valid(), {
        claimIds: ["SCH-002"],
        what: "the form of nothing but optionals reports itself invalid, so a consumer would not have submitted it and this battle asks nothing",
      });

      expectClaim(parsed.success, {
        claimIds: ["SCH-002"],
        what: "a form reporting itself valid holds a value the schema it was built from rejects, so parsing before submission throws on a form the library called ready",
        detail: parsed.success ? "" : JSON.stringify(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.code}`)),
      });
    } finally {
      form.destroy();
    }
  },
);
