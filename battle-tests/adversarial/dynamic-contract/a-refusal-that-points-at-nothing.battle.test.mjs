/**
 * A refusal that tells the caller what to do, and names something that is not there.
 *
 * `buildDynamicFormSchema` now refuses what it cannot use, by name and in production — the repair for
 * the schema doors. Its message goes further than most and tells the caller how to fix it:
 *
 *     [modyra] buildDynamicFormSchema takes a parsed document's root node, received a undefined.
 *     Parse the document first: parseDynamicForm(document).schema.
 *
 * `parseDynamicForm` returns no `schema`. Its result carries `ok`, `version`, `fields`, `layout`,
 * `rules`, `validations`, `collections`, `diagnostics`, `acceptedCount` and `rejectedCount`, for a
 * flat document and for a tree one alike. So a caller who does what the message says gets `undefined`
 * and the same refusal again, and the instruction is a circle.
 *
 * What the function does take is the document's own root — `document.schema`, a `{ children }` node
 * with or without a `node` beside it — which is what the caller already had before parsing anything.
 *
 * The check follows whatever expression the message names rather than a shape it happened to have:
 * an earlier version matched `parseDynamicForm(document).X`, and when the instruction was corrected
 * to `document.X` the match stopped firing and the battle stopped describing anything at all.
 *
 * And one shape still arrives as a JavaScript internal rather than as the refusal: an object with no
 * `children` in it. `{}` is the empty document, and `{ node: "group" }` is a section somebody left
 * unfinished; both are the shape the refusal exists for, and both miss it.
 *
 * A message that names a property is a promise that the property is there. This is the same species
 * as the refusals that name a list and show none — a sentence that cannot be acted on.
 */

import { buildDynamicFormSchema, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/**
 * A document carrying a tree, which is what this function is for.
 *
 * A v2/v3 document has an optional `schema` beside its `fields`: the flat list and the tree are two
 * slots on one document, and `buildDynamicFormSchema` reads the tree. A document that carries only
 * `fields` is not a document this function has anything to take from — `buildFlatFormSchema` is its
 * call — so it is not a case the advice has to answer for.
 */
const TREE = Object.freeze({
  version: 3,
  schema: { node: "group", children: { a: { node: "field", field: { kind: "text", label: "A" } } } },
});

/** Call and report what a consumer would see: a build, a named refusal, or an internal. */
function ask(build) {
  try {
    return { built: true, names: Object.keys(build()) };
  } catch (error) {
    return {
      built: false,
      internal: error?.constructor?.name === "TypeError" && !String(error.message).includes("[modyra]"),
      message: String(error?.message ?? error),
    };
  }
}

battle(
  {
    claims: ["DYN-001", "API-001"],
    title: "a refusal that says how to fix it names something the caller can reach",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: the shape it does take builds, so the refusals below are about the argument.
    const works = ask(() => buildDynamicFormSchema(TREE.schema));
    ctx.log.note("the shape it takes", works);

    expectEqual([works.built, works.names], [true, ["a"]], {
      claimIds: ["DYN-001"],
      what: "the document's own root did not build a schema, so nothing below is about the argument",
      detail: JSON.stringify(works),
    });

    // The second control: the named refusal exists and fires. This battle is not asking for one.
    const refused = ask(() => buildDynamicFormSchema(undefined));
    ctx.log.note("the refusal, and what it tells the caller to do", refused);

    expectClaim(refused.built === false && refused.message.includes("[modyra]"), {
      claimIds: ["API-001"],
      what: "the door no longer refuses by name, so there is no message to hold to its word",
      detail: JSON.stringify(refused),
    });

    // The instruction inside it. A message that tells the caller what to write is a promise about
    // what that expression yields — so the check follows the expression rather than a shape it
    // happened to have. An earlier version matched `parseDynamicForm(document).X`, which was the
    // wrong instruction; when it was corrected to `document.X` the match stopped firing and the
    // battle stopped describing anything. Reading the expression itself survives both.
    const named = /buildDynamicFormSchema\(([A-Za-z_$][\w$]*(?:\.[\w$]+)+)\)/.exec(refused.message);
    expectClaim(named !== null, {
      claimIds: ["API-001"],
      what: "the refusal stopped naming a way out, so this battle no longer describes it",
      detail: refused.message,
    });

    /** Walk the expression the message names against a real document, whatever its root is called. */
    const follow = (expression, document) => {
      const [root, ...steps] = expression.split(".");
      let value = root === "document" ? document : parseDynamicForm(document);
      for (const step of steps) value = value == null ? undefined : value[step];
      return value;
    };

    const advice = named?.[1] ?? "document.schema";
    const followed = { tree: follow(advice, TREE) };
    ctx.log.note("what the message's own instruction yields", {
      advice,
      tree: followed.tree === undefined ? "undefined" : typeof followed.tree,
    });

    // Following it has to give the function something it accepts. Anything else is a sentence that
    // sends the caller round again.
    const unusable = Object.entries(followed)
      .filter(([, value]) => ask(() => buildDynamicFormSchema(value)).built !== true)
      .map(([shape]) => shape);

    expectEqual(unusable, [], {
      claimIds: ["API-001", "DYN-001"],
      what: `the refusal tells the caller to write ${advice}, and doing that does not give this function something it takes`,
      detail: JSON.stringify({ advice, followed: Object.keys(followed) }),
    });

    // And the shapes that still arrive as an internal rather than as that refusal.
    const internals = [
      ["an empty document", {}],
      ["a section left unfinished", { node: "group" }],
    ]
      .map(([what, value]) => ({ what, ...ask(() => buildDynamicFormSchema(value)) }))
      .filter((each) => each.internal === true);

    expectEqual(internals, [], {
      claimIds: ["API-001"],
      what: "an object with no children reached the caller as a JavaScript internal instead of the refusal",
      detail: JSON.stringify(internals),
    });
  },
);
