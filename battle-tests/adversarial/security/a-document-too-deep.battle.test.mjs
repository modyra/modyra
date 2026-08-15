/**
 * A document that nests until the stack gives way.
 *
 * SEC-004 is that a document cannot make the form stop answering, and the guide names a document as
 * untrusted input: it arrives from a CMS, a model, a saved project, a POST. Its patterns are checked
 * for cost, its names for safety, its field kinds against a list — and its shape is walked by
 * recursion with nothing counting the levels.
 *
 * The same parser already does the counting for the other half of the same document.
 * `MDY_LAYOUT_MAX_DEPTH` is six, and a layout nested fifty thousand levels deep comes back with
 * `MDY_DYNAMIC_INVALID_LAYOUT` and no exception, because the depth is tested before the walk goes
 * further. The schema tree beside it, at the same depth in the same document, throws a `RangeError`
 * out of `parseDynamicForm` — in strict mode as well, which is the door the guide says to put in
 * front of a document before storing it.
 *
 * The depth at which it gives way is not a number worth asserting: it moves with whatever else is on
 * the stack, and was between five and fifty thousand levels across two runs of the same probe. What
 * is worth asserting is that there is one at all, and that the layout's answer is available to the
 * schema.
 */

import { MDY_LAYOUT_MAX_DEPTH, buildDynamicFormSchema, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Deep enough that the walk gives way on any machine this suite runs on. */
const DEEP = 50000;

const FIELD = Object.freeze({ node: "field", field: Object.freeze({ kind: "text", label: "F" }) });

/** A document whose schema nests `levels` groups around one field. */
function deepSchema(levels) {
  let node = FIELD;
  for (let level = 0; level < levels; level += 1) node = { node: "group", children: { g: node } };
  return { version: 2, schema: node };
}

/** A document whose *layout* nests that deep instead, around a schema of one field. */
function deepLayout(levels) {
  let node = { id: "leaf", kind: "section", children: [{ id: "s", field: "a" }] };
  for (let level = 0; level < levels; level += 1) node = { id: `l${level}`, kind: "section", children: [node] };
  return { version: 2, schema: { node: "group", children: { a: FIELD } }, layout: node };
}

const attempt = (fn) => {
  try {
    return { answered: true, value: fn() };
  } catch (error) {
    return { answered: false, threw: error?.constructor?.name ?? typeof error };
  }
};

battle(
  {
    claims: ["SEC-004", "DYN-001"],
    title: "a document nested past what the walk can carry is refused, not thrown out of",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the repair pattern: the layout half of the same document is bounded, and a
    // layout fifty thousand levels deep comes back as a diagnostic rather than an exception.
    expectClaim(Number.isInteger(MDY_LAYOUT_MAX_DEPTH) && MDY_LAYOUT_MAX_DEPTH > 0, {
      claimIds: ["DYN-001"],
      what: "the layout depth bound is not a number, so the comparison below has no precedent",
      detail: String(MDY_LAYOUT_MAX_DEPTH),
    });

    const layout = attempt(() => parseDynamicForm(deepLayout(DEEP), { mode: "lenient" }));
    ctx.log.note("a layout nested past its bound", {
      answered: layout.answered,
      diagnostics: layout.value?.diagnostics?.map((each) => each.code),
    });

    expectClaim(layout.answered && (layout.value.diagnostics ?? []).length > 0, {
      claimIds: ["SEC-004"],
      what: "a layout nested fifty thousand levels deep no longer comes back as a diagnostic",
      detail: JSON.stringify(layout),
    });

    // And the schema half, in the same parser, at the same depth. Both modes, because strict is the
    // door the guide says to put in front of a document before it is stored.
    for (const mode of ["lenient", "strict"]) {
      const parsed = attempt(() => parseDynamicForm(deepSchema(DEEP), { mode }));
      ctx.log.note("a schema nested as deep", { mode, ...parsed });

      expectEqual(parsed.answered, true, {
        claimIds: ["SEC-004"],
        what: `parsing a document nested ${DEEP} levels threw ${parsed.threw} in ${mode} mode instead of refusing it`,
      });
    }

    // Building from it is the same walk one door further on, and a consumer who parsed first has
    // already been told whether to.
    const built = attempt(() => buildDynamicFormSchema(deepSchema(DEEP).schema));
    ctx.log.note("building from a document as deep", built);

    expectEqual(built.answered, true, {
      claimIds: ["SEC-004"],
      what: `building a form from a document nested ${DEEP} levels threw ${built.threw}`,
    });
  },
);
