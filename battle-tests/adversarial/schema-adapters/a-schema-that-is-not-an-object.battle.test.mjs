/**
 * A Zod schema the bridge cannot build a form from, and what it says instead.
 *
 * `createZodForm` builds a form from a Zod schema. A form has named fields, so a schema that is not an
 * object has no fields to name — `z.array(...)`, `z.string()`, `z.tuple([...])` are all legitimate Zod
 * schemas and none of them describes a form.
 *
 * Refusing them is right. What arrives instead is a `TypeError` from inside JavaScript:
 *
 *     Cannot convert undefined or null to object
 *
 * It names no schema, no shape and no call. A consumer sees an internal, and the three different
 * mistakes are indistinguishable from each other and from a bug in the bridge.
 *
 * The bridge's own fallback is the control, and it is good: a shape the engine has no structure for —
 * a union, a discriminated union, an intersection, a recursive schema — becomes one opaque leaf, and
 * Zod goes on validating it in full, discriminator errors included. So this is not "unusual shapes
 * break it". It is that the one case with nothing to fall back to reports an internal instead of a
 * refusal.
 */

import { createZodForm } from "@modyra/zod";
import { z } from "zod";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/** Build a form from `schema` and report what happened, without letting a throw escape. */
function buildFrom(schema) {
  try {
    const form = createZodForm(schema, { devWarnings: true });
    const names = form.fieldNames();
    form.destroy();
    return { built: true, names };
  } catch (error) {
    return { built: false, kind: error?.constructor?.name ?? "unknown", message: String(error?.message ?? error) };
  }
}

battle(
  {
    claims: ["API-001", "SCH-001"],
    title: "a schema that cannot describe a form is refused by name, not by a TypeError",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: an object schema builds, so what follows is the shape rather than the
    // bridge being unreachable.
    const object = buildFrom(z.object({ a: z.string() }));
    ctx.log.note("an object schema, which is what a form is", object);

    expectEqual(object.built && object.names, ["a"], {
      claimIds: ["SCH-001"],
      what: "an object schema did not build a form with the field it declares",
      detail: JSON.stringify(object),
    });

    // The second control, and the reason this finding is narrow: a shape the engine has no structure
    // for is not a failure. It becomes one opaque leaf and Zod keeps validating it in full.
    const branching = createZodForm(
      z.object({
        d: z.discriminatedUnion("t", [
          z.object({ t: z.literal("a"), x: z.string() }),
          z.object({ t: z.literal("b"), y: z.number() }),
        ]),
      }),
      { devWarnings: false },
    );
    branching.f.d.set({ t: "a", x: "ok" });
    await settled();
    const accepted = branching.state.valid();
    branching.f.d.set({ t: "c" });
    await settled();
    const refusedByZod = branching.errorsFor("d")().map((each) => String(each.message));
    branching.destroy();
    ctx.log.note("a discriminated union as one opaque leaf", { accepted, refusedByZod });

    expectClaim(accepted && refusedByZod.length > 0, {
      claimIds: ["SCH-001"],
      what: "the opaque leaf a branching schema becomes does not carry Zod's own verdict",
      detail: JSON.stringify({ accepted, refusedByZod }),
    });

    // And the schemas that describe no form at all.
    const outcomes = [];
    for (const [what, schema] of [
      ["z.array(z.object(…))", z.array(z.object({ v: z.string() }))],
      ["z.string()", z.string()],
      ["z.tuple([z.string()])", z.tuple([z.string()])],
    ]) {
      const outcome = buildFrom(schema);
      ctx.log.note("a schema that is not an object", { what, ...outcome });
      outcomes.push({ what, ...outcome });
    }

    // Either repair closes it: build something, or refuse with a message the library wrote. What this
    // refuses is a JavaScript internal reaching a consumer.
    //
    // The predicate reads the error's *kind* rather than looking for a word in its text. The first
    // version searched for "schema", "object" or "form" and passed — because "Cannot convert
    // undefined or null to object" contains "object". A check for a word is a check a string can
    // satisfy by accident; a raw `TypeError` is not something this library throws on purpose.
    const internals = outcomes.filter(
      (each) => each.built === false && (each.kind === "TypeError" || !each.message.includes("[modyra]")),
    );
    expectEqual(internals, [], {
      claimIds: ["API-001"],
      what: "a schema that cannot describe a form raised an internal error naming neither the schema nor what a form needs",
      detail: JSON.stringify(outcomes),
    });
  },
);
