/**
 * A correct document that reports something was lost.
 *
 * `acceptedCount + rejectedCount` is what a document *declared*, which is the rule that makes the
 * pair worth reading: a caller can tell "three fields, one of them refused" from "two fields". The
 * counter is deliberately the least informed reader of the shape — it counts, it does not interpret —
 * and a node that is neither a field nor a container it knows how to walk counts as a declaration
 * that did not become a field.
 *
 * A collection is one of those. It is understood — it is reported in `collections`, by path and by
 * kind — and its cells are not flat fields, because a document cannot name the rows that do not exist
 * yet. So a correct document declaring one record reports `ok: true`, `rejectedCount: 1`, and **no
 * diagnostic at all**.
 *
 * A rejection with no reason is the tell. Everything else that raises the count says why: a broken
 * field is rejected *and* carries `MDY_DYNAMIC_UNKNOWN_KIND`. An author reading "1 rejected" on a
 * document with nothing wrong with it is told something was lost, and there is nothing to look at.
 *
 * Either repair closes it: count a collection as accepted, since it is understood and reported, or
 * give every rejection a reason. What this refuses is a number that says a thing was lost and cannot
 * name it.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const cell = (label) => ({ node: "field", field: { kind: "text", label } });
const document = (children) => ({ version: 3, schema: { node: "group", children } });

/** Parse in strict mode and report the three numbers a caller reads together. */
function counted(children) {
  const result = parseDynamicForm(document(children), { mode: "strict" });
  return {
    ok: result.ok,
    accepted: result.acceptedCount,
    rejected: result.rejectedCount,
    codes: (result.diagnostics ?? []).map((each) => each.code),
    collections: (result.collections ?? []).map((each) => each.path),
    fields: (result.fields ?? []).map((each) => each.name),
  };
}

battle(
  {
    claims: ["DYN-003", "DYN-002"],
    title: "everything a document is told it lost has a reason beside it",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: a document with nothing wrong loses nothing.
    const clean = counted({ a: cell("A"), b: cell("B") });
    ctx.log.note("a document with two fields", clean);

    expectEqual([clean.ok, clean.accepted, clean.rejected], [true, 2, 0], {
      claimIds: ["DYN-003"],
      what: "a clean document did not count two fields and no losses",
      detail: JSON.stringify(clean),
    });

    // The second control: a rejection that is one carries its reason, which is what makes the
    // silence below visible as a silence.
    const broken = counted({ a: cell("A"), bad: { node: "field", field: { kind: "wormhole", label: "B" } } });
    ctx.log.note("a document with a field nobody can render", broken);

    expectClaim(broken.rejected === 1 && broken.codes.length > 0 && broken.ok === false, {
      claimIds: ["DYN-003"],
      what: "a genuinely refused node was counted without a diagnostic, so a reason is not what separates the two cases",
      detail: JSON.stringify(broken),
    });

    // And a document with nothing wrong with it that declares a collection.
    for (const [what, children] of [
      ["a record", { title: cell("T"), rows: { node: "record", item: { node: "group", children: { code: cell("C") } } } }],
      ["an array", { title: cell("T"), list: { node: "array", item: { node: "group", children: { tag: cell("G") } } } }],
    ]) {
      const seen = counted(children);
      ctx.log.note("a correct document declaring a collection", { what, ...seen });

      // The premise: the collection was understood. It is reported by path and by kind, which is what
      // makes counting it as a loss a contradiction rather than a judgement.
      expectEqual(seen.collections.length, 1, {
        claimIds: ["DYN-002"],
        what: `${what} was not reported in collections, so counting it as rejected is not a contradiction`,
        detail: JSON.stringify(seen),
      });

      expectClaim(seen.rejected === 0 || seen.codes.length > 0, {
        claimIds: ["DYN-003"],
        what: `${what}: a correct document was told ${seen.rejected} thing(s) were lost, with nothing said about any of them`,
        detail: JSON.stringify(seen),
      });
    }
  },
);
