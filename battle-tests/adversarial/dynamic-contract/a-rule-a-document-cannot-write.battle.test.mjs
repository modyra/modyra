/**
 * A condition on a row of a collection: not expressible, and said so.
 *
 * A document can declare a collection — `{ node: "record", item: … }` — and it can declare rules that
 * reveal, hide, enable or disable a field. The two do not meet: a rule names its target by path, and
 * a cell of a row has no path until the application creates the row. Every way of trying is refused:
 *
 *   target "rows.detail"        MDY_DYNAMIC_INVALID_RULE
 *   target "rows.*.detail"      MDY_DYNAMIC_INVALID_RULE
 *   target "rows.item.detail"   MDY_DYNAMIC_INVALID_RULE
 *   target "rows.a.detail"      MDY_DYNAMIC_INVALID_RULE
 *   target "detail"             MDY_DYNAMIC_INVALID_RULE
 *   target "plain"              accepted                    ← the control
 *
 * This battle is green, and it holds the refusal rather than the capability. That is the point: a
 * missing capability which is **reported** is a limit, and a missing capability which is accepted is
 * a defect. Finding 208 is the same contract accepting a rule that no declared choice can ever
 * satisfy — parsed, kept, silently inert, with a field left permanently on the wrong side. Here the
 * same parser refuses instead, which is the behaviour 208 is asking for.
 *
 * So this is a regression guard on the precedent. If a later change teaches the parser to accept
 * `rows.detail` because it looks like a path, without teaching the engine to apply it per row, the
 * contract will have swapped a stated limit for a silent one — and that trade is exactly what
 * `expression.ts` spends three paragraphs refusing elsewhere.
 *
 * What the contract cannot express is recorded beside the guard rather than asserted as a defect:
 * "in every row, show `detail` when `kind` is b" is a property of the row's *shape*, not of a
 * session, and a form builder emitting collections has no way to say it.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const fieldNode = (spec) => ({ node: "field", field: spec });

/** A document with a plain field beside a record whose rows carry two cells. */
function documentRuling(target, whenField) {
  return {
    version: 2,
    schema: {
      node: "group",
      children: {
        plain: fieldNode({ kind: "text", label: "Plain" }),
        rows: {
          node: "record",
          item: {
            node: "group",
            children: {
              kind: fieldNode({
                kind: "select",
                label: "K",
                options: [
                  { value: "a", label: "A" },
                  { value: "b", label: "B" },
                ],
              }),
              detail: fieldNode({ kind: "text", label: "D" }),
            },
          },
        },
      },
    },
    rules: [{ effect: "visible", target, when: { field: whenField, operator: "equals", value: "b" } }],
  };
}

function parseRuling(target, whenField) {
  const parsed = parseDynamicForm(documentRuling(target, whenField), { mode: "lenient" });
  return {
    kept: parsed.rules.length,
    codes: parsed.diagnostics.map((each) => each.code),
    collections: parsed.collections.map((each) => `${each.path}:${each.kind}`),
  };
}

battle(
  {
    claims: ["DYN-004", "COL-001"],
    title: "a rule a document cannot express is refused rather than kept",
    environments: ["node"],
  },
  async (ctx) => {
    const control = parseRuling("plain", "plain");
    const attempts = [
      { addressed: "rows.detail", ...parseRuling("rows.detail", "rows.kind") },
      { addressed: "rows.*.detail", ...parseRuling("rows.*.detail", "rows.*.kind") },
      { addressed: "rows.item.detail", ...parseRuling("rows.item.detail", "rows.item.kind") },
      { addressed: "rows.a.detail", ...parseRuling("rows.a.detail", "rows.a.kind") },
      { addressed: "detail", ...parseRuling("detail", "kind") },
    ];
    ctx.log.note("every way a document could address a row's cell in a rule", { control, attempts });

    // The instrument: the document is otherwise sound — the collection is recognised, and a rule on
    // a field outside it is accepted. Without this, "everything is refused" could describe a
    // document the parser rejected for some other reason entirely.
    expectClaim(control.kept === 1 && control.codes.length === 0 && control.collections.includes("rows:record"), {
      claimIds: ["DYN-004"],
      what: "the document is not one the parser otherwise accepts, so the refusals below say nothing about addressing a row",
      detail: JSON.stringify(control),
    });

    // Refused, and named. A rule kept but inert is finding 208; a rule refused is a stated limit.
    expectEqual(
      attempts.filter((entry) => entry.kept > 0 || !entry.codes.includes("MDY_DYNAMIC_INVALID_RULE")).map((entry) => entry.addressed),
      [],
      {
        claimIds: ["DYN-004", "COL-001"],
        what: "a rule addressing a cell of a row was kept, or refused without saying so — a capability that is missing must be reported, not silently inert",
      },
    );
  },
);
