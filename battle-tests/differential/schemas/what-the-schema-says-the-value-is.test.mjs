/**
 * The value a derived form holds, against the value its schema produces.
 *
 * `createZodForm(schema)` derives a whole form from a `z.object()`, and Zod is its own oracle: the
 * same value can be put through `schema.safeParse` and through the form, and the two answers
 * compared. On the question of what is *allowed* they agree everywhere measured — length, range,
 * regex, int, positive, multipleOf, enum, literal, email, url, uuid, refine, superRefine, union,
 * optional, nullable, and a transform behind a `pipe`. That is the first battle, and it is what makes
 * the others specific.
 *
 * They do not agree on what the value *is*, and that is the form's side of a real division. A
 * schema's parse output is the value after its transformations — `.trim()`, `.toLowerCase()`,
 * `.transform()`, `.catch()`, `z.coerce.*`. A form holds what the person typed: trimming on every
 * keystroke takes the space away while they are still typing it, and coercing `"4"` to `4` rewrites
 * a number halfway through `"42"`.
 *
 * So what has to hold is not that the two agree, but that the package **says which one it is**. Both
 * bridges say it in their published leaf type, and the guide beside them has to agree:
 *
 *     @modyra/zod               MdyFieldDescriptor<z.input<Piece> | null>
 *     @modyra/standard-schema   a tree mapped over MdyStandardInput
 *     docs/guides/schemas.md    "Leaves are `Input | null` (null = not filled in)"
 *
 * Each battle here takes either answer: the value is what the schema produces, or the published type
 * describes the value the form really holds. Written that way because a form that transforms and a
 * form that declares what it keeps are both defensible, and a form that keeps one thing while its
 * type promises another is not.
 *
 * The last battle asks the same question of the other bridge through Zod acting as a Standard Schema
 * vendor, because the spec's `~standard.validate` returns the output value and so is an oracle of the
 * same kind.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  // Inside the descriptor's argument, not immediately after the angle bracket. The leaf type is
  // wrapped — `MdyFieldDescriptor<Exclude<z.input<Shape[K]>, undefined> | null>` — and a pattern
  // anchored on the first token fixes a spelling where it means a decision: the package still says
  // `input`, and a wrapper it gains is not the decision moving.
  const inDescriptor = (word) => new RegExp(`MdyFieldDescriptor<[^;\n]{0,160}z\\.${word}<`).test(text);
  return {
    saysOutput: inDescriptor("output"),
    saysInput: inDescriptor("input"),
  };
}

/**
 * What the other bridge publishes about its leaves, in its types and in the guide beside them.
 *
 * The same question as `publishedLeafType`, asked of the package that has its own spelling for it:
 * a tree mapped over the schema's input describes a form that holds what was typed.
 */
function publishedStandardLeafType() {
  const entry = fileURLToPath(import.meta.resolve("@modyra/standard-schema"));
  const text = readFileSync(entry.replace(/\.js$/, ".d.ts"), "utf8");
  const guide = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "guides", "schemas.md"), "utf8");
  return {
    saysInput: /MdyStandardInput</.test(text),
    saysOutput: /MdyStandardOutput</.test(text),
    guideSaysInput: /Leaves are `Input \| null`/.test(guide),
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

    // Either the value is what the schema produces, or what the package publishes describes what the
    // form really holds. A form holds what a person typed, which is a defensible thing for a form to
    // do and an indefensible thing to hold silently under a type that says otherwise — so the tree's
    // own spelling settles it, and the guide beside it has to agree.
    const published = publishedStandardLeafType();
    ctx.log.note("what the other bridge publishes about its leaves", published);

    expectClaim(published.saysInput || published.saysOutput, {
      claimIds: ["DYN-001"],
      what: "the published leaf type is neither the schema's input nor its output, so this battle cannot say what was promised",
      detail: JSON.stringify(published),
    });

    expectClaim(held === produced.value.f || (published.saysInput && published.guideSaysInput), {
      claimIds: ["DYN-001", "SUB-001"],
      what: "the form holds the input while its tree or its guide still describes the output, so a consumer reads one kind of thing and submits another",
      detail: JSON.stringify({ held, heldType: typeof held, schemaProduces: produced.value.f, published }),
    });

    form.destroy();
  },
);
