/**
 * The value a Zod form holds, against the value the schema itself produces.
 *
 * `createZodForm(schema)` derives a whole form from a `z.object()`. Zod is its own oracle here: the
 * same value can be put through `schema.safeParse` and through the form, and the two answers
 * compared. On the question of what is *allowed* they agree everywhere measured — length, range,
 * regex, int, positive, multipleOf, enum, literal, email, url, uuid, refine, superRefine, union,
 * optional, nullable, and a transform behind a `pipe`. That is the control battle, and it is what
 * makes the second one specific.
 *
 * They do not agree on what the value *is*. Zod's parse output is the value after its transformations
 * — `.trim()`, `.toLowerCase()`, `.transform()`, `.catch()`, `z.coerce.*`. The form holds what was
 * put in, and submits it.
 *
 * That would be a defensible choice for a form library — a form holds what the person typed — except
 * for what the package publishes about it. The leaf type is written twice, in the derived tree and in
 * the item descriptor, as `MdyFieldDescriptor<z.output<Piece> | null>`, and the comment above it says
 * so in words: "every other schema becomes a leaf field typed `z.output<Piece> | null`". `z.output`
 * is the type *after* the transformations that are not applied. So for any piece whose transform
 * changes the type, the declared type and the held value are different kinds of thing:
 * `z.coerce.number()` declares `number | null` and holds `"42"`.
 *
 * `docs/guides/schemas.md` is the guide for this adapter and does not mention transformations,
 * coercion, or the difference between a form's value and a schema's output.
 *
 * Three repairs, and the battle is written to accept any of them: apply the schema's transformations
 * to the value, refuse to derive a form from a transforming schema, or declare the leaf as
 * `z.input` so the published type describes what is really there. The last is why the battle reads
 * the published type rather than only the values — a repair that retyped the leaves would otherwise
 * leave it red forever.
 *
 * The other bridge says the same thing by a different route and behaves the same way.
 * `MdyStandardSchemaTree` maps over `MdyStandardOutput<TSchema>`, and `docs/guides/schemas.md:39`
 * puts it in prose beside the example a reader copies: "Leaves are `Output | null`". The third
 * battle holds that one, through Zod acting as a Standard Schema vendor, because the spec's
 * `~standard.validate` returns the output value and so is an oracle of the same kind.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { z } from "zod";
import { createZodForm } from "@modyra/zod";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Rules whose only job is to accept or refuse. Zod's verdict and the form's must match. */
const CONSTRAINTS = Object.freeze([
  ["string.min(3)", z.string().min(3), ["ab", "abc"]],
  ["string.max(3)", z.string().max(3), ["abc", "abcd"]],
  ["string.regex", z.string().regex(/^a+$/), ["aaa", "aab"]],
  ["string.length(3)", z.string().length(3), ["ab", "abc", "abcd"]],
  ["number.min(5)", z.number().min(5), [4, 5]],
  ["number.int", z.number().int(), [3, 3.5]],
  ["number.positive", z.number().positive(), [1, 0]],
  ["number.multipleOf(3)", z.number().multipleOf(3), [3, 4]],
  ["enum", z.enum(["a", "b"]), ["a", "c"]],
  ["literal", z.literal("only"), ["only", "other"]],
  ["refine", z.string().refine((value) => value.startsWith("ok"), "must start with ok"), ["okay", "nope"]],
  ["superRefine", z.string().superRefine((value, ctx) => {
    if (value.length < 3) ctx.addIssue({ code: "custom", message: "short" });
  }), ["abc", "ab"]],
  ["union", z.union([z.string().min(3), z.number().min(10)]), ["abc", "ab", 11, 9]],
]);

/** Pieces whose parse output is not their input. The last four also change the type. */
const TRANSFORMING = Object.freeze([
  ["trim", z.string().trim(), "  padded  "],
  ["transform", z.string().transform((value) => value.replace(/\s+/g, "")), " a b c "],
  ["catch", z.number().min(5).catch(99), 1],
  ["coerce.number", z.coerce.number(), "42"],
  ["coerce.boolean", z.coerce.boolean(), "yes"],
  ["transform to number", z.string().transform((value) => value.length), "abcd"],
  ["transform to array", z.string().transform((value) => value.split(",")), "a,b"],
]);

/** The published leaf type, read from where the package says its types are. */
function publishedLeafType() {
  const entry = fileURLToPath(import.meta.resolve("@modyra/zod"));
  const types = entry.replace(/\.js$/, ".d.ts");
  const text = readFileSync(types, "utf8");
  return {
    saysOutput: /MdyFieldDescriptor<z\.output</.test(text),
    saysInput: /MdyFieldDescriptor<z\.input</.test(text),
  };
}

battle(
  {
    claims: ["DYN-001", "VAL-004"],
    title: "a derived form allows exactly what the schema allows",
    environments: ["node"],
  },
  async (ctx) => {
    const disagreed = [];
    for (const [name, piece, values] of CONSTRAINTS) {
      const object = z.object({ f: piece });
      const form = createZodForm(object, { devWarnings: false });
      for (const value of values) {
        const zodAccepts = object.safeParse({ f: value }).success;
        form.f.f.set(value);
        const formAccepts = form.errorsFor("f")().length === 0;
        if (zodAccepts !== formAccepts) disagreed.push({ name, value, zodAccepts, formAccepts });
      }
      form.destroy();
    }
    ctx.log.note("where the two verdicts differ", { checked: CONSTRAINTS.length, disagreed });

    // The control: some of these are meant to be refused, so a run in which everything was accepted
    // would agree for the wrong reason.
    const refusals = CONSTRAINTS.reduce((total, [, piece, values]) => {
      const object = z.object({ f: piece });
      return total + values.filter((value) => !object.safeParse({ f: value }).success).length;
    }, 0);
    expectClaim(refusals >= CONSTRAINTS.length, {
      claimIds: ["VAL-004"],
      what: "the corpus barely refuses anything, so agreement about refusals means little",
      detail: JSON.stringify({ refusals }),
    });

    expectEqual(disagreed, [], {
      claimIds: ["DYN-001", "VAL-004"],
      what: "a derived form and the schema it came from disagreed about whether a value is allowed",
    });
  },
);

battle(
  {
    claims: ["DYN-001", "SUB-001"],
    title: "the value a derived form submits is the value its schema describes",
    environments: ["node"],
  },
  async (ctx) => {
    const published = publishedLeafType();
    ctx.log.note("what the package publishes about its leaves", published);

    // The premise: the published type is one of the two this battle knows how to read. If the
    // declaration were rewritten into some third shape, the assertion below would be measuring a
    // question that no longer exists.
    expectClaim(published.saysOutput || published.saysInput, {
      claimIds: ["DYN-001"],
      what: "the published leaf type is neither z.output nor z.input, so this battle cannot say what was promised",
    });

    const divergent = [];
    for (const [name, piece, input] of TRANSFORMING) {
      const object = z.object({ f: piece });
      const parsed = object.safeParse({ f: input });
      let form = null;
      try {
        form = createZodForm(object, { devWarnings: false });
      } catch {
        // Refusing to derive a form from a transforming schema is one of the repairs. A schema that
        // is refused is not a divergence.
        continue;
      }
      form.f.f.set(input);
      const held = form.getValue().f;
      if (parsed.success && JSON.stringify(held) !== JSON.stringify(parsed.data.f)) {
        divergent.push({
          name,
          input,
          schemaProduces: parsed.data.f,
          formHolds: held,
          sameType: typeof held === typeof parsed.data.f,
        });
      }
      form.destroy();
    }
    ctx.log.note("where the held value is not the schema's output", { divergent });

    // The control: these pieces really do transform, so a run with nothing divergent would have to
    // be a repair rather than a corpus that never asked anything.
    const transforms = TRANSFORMING.filter(([, piece, input]) => {
      const parsed = z.object({ f: piece }).safeParse({ f: input });
      return parsed.success && JSON.stringify(parsed.data.f) !== JSON.stringify(input);
    });
    expectEqual(transforms.length, TRANSFORMING.length, {
      claimIds: ["DYN-001"],
      what: "a piece in this corpus does not transform its input, so it cannot show a divergence either way",
    });

    // Green under any of the three repairs: the values agree, the schema was refused, or the
    // published type says `z.input` and so describes what is really held.
    expectClaim(divergent.length === 0 || published.saysInput, {
      claimIds: ["DYN-001", "SUB-001"],
      what: "the form holds and submits a value its schema would have transformed, while the published leaf type is z.output — the type after the transformation that was not applied",
      detail: JSON.stringify(divergent),
    });
  },
);

battle(
  {
    claims: ["DYN-001", "SUB-001"],
    title: "the other bridge's value is the one its schema describes too",
    environments: ["node"],
  },
  async (ctx) => {
    const { createStandardForm } = await import("@modyra/standard-schema");
    const { field } = await import("@modyra/core");

    // Zod implements the Standard Schema interface, so it can be the vendor here. What is being
    // measured is this adapter, not Zod: `~standard.validate` returns the output value, which is the
    // oracle.
    const schema = z.object({ f: z.coerce.number() });
    expectClaim(typeof schema["~standard"]?.validate === "function", {
      claimIds: ["DYN-001"],
      what: "the vendor does not implement the Standard Schema interface, so nothing here is measured through it",
    });

    const produced = schema["~standard"].validate({ f: "42" });
    ctx.log.note("what the standard interface produces", { produced });

    // The premise: this schema really does transform. A vendor that returned the input unchanged
    // would make the comparison below empty.
    expectEqual(produced.value?.f, 42, {
      claimIds: ["DYN-001"],
      what: "the schema did not coerce, so there is no transformation to lose",
    });

    const form = createStandardForm(schema, { f: field(null) }, { devWarnings: false });
    form.f.f.set("42");
    await new Promise((resolve) => setTimeout(resolve, 60));
    const held = form.getValue().f;
    ctx.log.note("what the derived form holds", { held, type: typeof held, errors: form.errorsFor("f")().length });

    // The control: the form accepts the value, so a divergence below is about what it kept rather
    // than about a value it refused.
    expectEqual(form.errorsFor("f")().length, 0, {
      claimIds: ["DYN-001"],
      what: "the form refused a value its own schema accepts",
      detail: JSON.stringify(form.errorsFor("f")().map((each) => each.message)),
    });

    expectEqual(held, produced.value.f, {
      claimIds: ["DYN-001", "SUB-001"],
      what: "the form holds the input where its schema tree is typed from the output — `MdyStandardSchemaTree` maps over `MdyStandardOutput`, and the guide says \"Leaves are `Output | null`\"",
      detail: JSON.stringify({ held, heldType: typeof held, schemaProduces: produced.value.f }),
    });

    form.destroy();
  },
);
