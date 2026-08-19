/**
 * A depth limit the contract names, on a walk that does not have one.
 *
 * `expression.ts:238` explains why an expression tree is capped at 32, and it argues by precedent:
 *
 * > recursion over one is bounded for the same reason the **schema is bounded at 8 levels and the
 * > layout at 6**: a document deep enough to exhaust the call stack would take the host down instead
 * > of being reported.
 *
 * The layout is. Measured: six levels of nested sections parse, seven are refused with
 * `MDY_DYNAMIC_INVALID_LAYOUT`, three thousand likewise.
 *
 * The schema is not. A group nested one hundred thousand deep parses clean — `ok: true`, no
 * diagnostic — in 59ms, and produces one field:
 *
 *   100 levels        1 ms    field name      204 characters
 *   10 000 levels     8 ms    field name   20 004 characters
 *   100 000 levels   59 ms    field name  200 004 characters
 *
 * The stack survives, so the failure the sentence describes does not happen — the walk is not
 * recursive. What does happen is that a document names a field with two hundred thousand characters,
 * and that name is not a label: it is a path, a payload key, a draft key, and a string every
 * renderer carries per control. The cost is linear in the document and unbounded in the name.
 *
 * The battle does not assert the number eight. Imposing it now would refuse documents nine levels
 * deep that work today, and the sentence may simply be describing an intention. It asserts that
 * there **is** a bound — the property the sentence claims, at whatever depth the contract chooses —
 * with the layout beside it as proof that this codebase already knows how to have one.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A field wrapped in `depth` groups. */
function nestedSchema(depth) {
  let node = { node: "field", field: { kind: "text", label: "L" } };
  for (let level = 0; level < depth; level += 1) node = { node: "group", children: { g: node } };
  return { version: 2, schema: { node: "group", children: { root: node } } };
}

/** A section wrapped in `depth` sections. */
function nestedLayout(depth) {
  let node = { kind: "section", id: "s0", children: ["a"] };
  for (let level = 1; level < depth; level += 1) node = { kind: "section", id: `s${level}`, children: [node] };
  return { version: 2, fields: [{ name: "a", kind: "text", label: "A" }], layout: [node] };
}

function parsedAt(document) {
  const parsed = parseDynamicForm(document, { mode: "lenient" });
  return {
    kept: parsed.fields.length,
    layout: parsed.layout?.length ?? 0,
    codes: parsed.diagnostics.map((each) => each.code),
    longestName: Math.max(0, ...parsed.fields.map((each) => each.name.length)),
  };
}

battle(
  {
    claims: ["SEC-004", "DYN-004"],
    title: "a document cannot nest deeper than the contract says it may",
    environments: ["node"],
  },
  async (ctx) => {
    const layout = { shallow: parsedAt(nestedLayout(6)), deep: parsedAt(nestedLayout(3000)) };
    const schema = {
      shallow: parsedAt(nestedSchema(6)),
      deep: parsedAt(nestedSchema(100_000)),
    };
    ctx.log.note("how deep each half of a document may go", { layout, schema });

    // The control, and it is what makes this an inconsistency rather than a missing feature: the
    // layout half already has the bound, and a shallow document of either half is accepted.
    expectClaim(
      layout.shallow.layout === 1 &&
        layout.deep.layout === 0 &&
        layout.deep.codes.includes("MDY_DYNAMIC_INVALID_LAYOUT") &&
        schema.shallow.kept === 1,
      {
        claimIds: ["DYN-004"],
        what: "the layout has no bound either, or a shallow document is refused, so the probe is wrong before the contract is",
        detail: JSON.stringify({ layout, schemaShallow: schema.shallow }),
      },
    );

    expectEqual(
      { deeplyNestedSchemaAccepted: schema.deep.kept > 0 && schema.deep.codes.length === 0 },
      { deeplyNestedSchemaAccepted: false },
      {
        claimIds: ["SEC-004", "DYN-004"],
        what: `a schema nested 100000 deep parsed clean and named a field ${schema.deep.longestName} characters long, which becomes a path, a payload key and a draft key`,
      },
    );
  },
);
