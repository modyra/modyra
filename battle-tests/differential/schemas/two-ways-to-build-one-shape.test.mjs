/**
 * A document built twice: from its tree, and from the flat pair it flattens to.
 *
 * DYN-002 is "collection kind survives flattening and reconstruction", and its evidence is
 * `flattenDynamicForm`/`flattenDynamicSchema`. The claim was read early in this campaign as ambiguous
 * about nesting, because a nested collection did not appear in `collections` — and the reason it did
 * not is the rule rather than a gap: a collection is reported at a *concrete* path, there is no
 * wildcard spelling in the contract, and a nested collection has no path until its parent has rows.
 *
 * Give the parent rows and the whole thing appears:
 *
 *     no initial rows      collections: rows
 *     two initial rows     collections: rows, rows.0.lines, rows.1.lines
 *     a row with a row     fields: rows.0.c, rows.0.lines.0.c
 *
 * So the flat pair says exactly what can be named, and this checks the half that matters: that
 * rebuilding from it produces the same form as building from the tree. The tree build is the
 * reference — it is the route with nothing in between — and the flat route has to agree with it.
 */

import {
  buildDynamicFormSchema,
  buildFlatFormSchema,
  createForm,
  flattenDynamicForm,
  vanillaReactivity,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = (label) => ({ node: "field", field: { kind: "text", label } });
const innerArray = { node: "array", label: "L", item: { node: "group", children: { c: leaf("C") } } };

/** Documents whose shape a flat pair has to be able to carry. */
const SHAPES = Object.freeze({
  "a flat group": { node: "group", children: { a: leaf("A"), b: leaf("B") } },
  "a nested group": { node: "group", children: { g: { node: "group", label: "G", children: { a: leaf("A") } } } },
  "an array with rows": {
    node: "group",
    children: { rows: { node: "array", label: "R", initialValue: [{ c: "a" }, { c: "b" }],
      item: { node: "group", children: { c: leaf("C") } } } },
  },
  "a record with keys": {
    node: "group",
    children: { rows: { node: "record", label: "R", initialValue: { k1: { c: "a" }, k2: { c: "b" } },
      item: { node: "group", children: { c: leaf("C") } } } },
  },
  "an array inside an array's row": {
    node: "group",
    children: { rows: { node: "array", label: "R", initialValue: [{ c: "a", lines: [{ c: "x" }] }],
      item: { node: "group", children: { c: leaf("C"), lines: innerArray } } } },
  },
});

const valueOf = (schema) => {
  const form = createForm(schema, { reactivity: vanillaReactivity(), devWarnings: false });
  const value = form.getValue();
  form.destroy();
  return value;
};

battle(
  {
    claims: ["DYN-002", "DYN-001"],
    title: "a document rebuilt from what it flattens to holds what the tree holds",
    environments: ["node"],
  },
  async (ctx) => {
    const differed = [];
    for (const [what, schema] of Object.entries(SHAPES)) {
      const flat = flattenDynamicForm(schema);
      const fromTree = valueOf(buildDynamicFormSchema(schema));
      const fromFlat = valueOf(buildFlatFormSchema(flat.fields, flat.collections));
      ctx.log.note("one document, two routes", {
        what,
        fields: flat.fields.map((each) => each.name),
        collections: flat.collections,
      });
      if (JSON.stringify(fromTree) !== JSON.stringify(fromFlat)) {
        differed.push({ what, fromTree, fromFlat });
      }
    }

    // The control: the shapes are not all the same shape. A corpus of flat groups would agree by
    // having nothing to disagree about.
    const withRows = flattenDynamicForm(SHAPES["an array inside an array's row"]);
    expectClaim(withRows.collections.length >= 2 && withRows.fields.length >= 2, {
      claimIds: ["DYN-002"],
      what: "the deepest shape in this corpus flattened to nothing, so agreement below is empty",
      detail: JSON.stringify(withRows),
    });

    // And the rule the ambiguity resolved into: a collection is named where it has a path, and a
    // nested one has none until its parent has rows.
    const withoutRows = flattenDynamicForm({
      node: "group",
      children: { rows: { node: "array", label: "R", item: { node: "group", children: { lines: innerArray } } } },
    });
    expectEqual(withoutRows.collections.map((each) => each.path), ["rows"], {
      claimIds: ["DYN-002"],
      what: "a collection with no rows named an inner collection that has no path yet",
      detail: JSON.stringify(withoutRows),
    });

    expectEqual(differed, [], {
      claimIds: ["DYN-002", "DYN-001"],
      what: "a document rebuilt from its flat pair holds a different shape from the one its tree builds",
    });
  },
);
