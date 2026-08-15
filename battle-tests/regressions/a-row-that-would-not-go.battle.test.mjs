/**
 * A row that survives being told to leave, and what makes it different from the rows that go.
 *
 * The record manager states the rule in its own words: re-declaring replaces what is there. An
 * `upsert` on a key that already names a row is not a patch — the row it describes is the row there
 * is afterwards, including the collections it does or does not carry.
 *
 * It holds, until the row carries a collection of its own. Then re-declaring the parent with an empty
 * list leaves one row behind, and the text cell of that row holds `null` — which is not a value a text
 * field can hold anywhere else in the engine.
 *
 * The discriminator is the whole finding, because without it this reads as "sometimes a row stays".
 * A row of text cells goes. A row of two text cells goes. A row carrying a nested list stays, a row
 * carrying a nested map stays, and a row that is nothing but a nested list stays. What decides is
 * whether the row has a collection inside it, not how many cells it has or what they hold.
 *
 * Three operations, and the third is the whole edit:
 *
 *   upsert orders.a = { ref: "first",  lines: [] }
 *   push   orders.a.lines = { sku: "S1", allocations: [] }
 *   upsert orders.a = { ref: "second", lines: [] }
 *
 * The generative campaign has been reporting this for a while; what is new here is the reduction and
 * the condition. A property reports one counterexample of twenty-four operations, and the shape that
 * separates it from the cases that work is not visible in one.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

/** Build a form whose orders hold lines of `lineGroup`, and re-declare the order with no lines. */
function afterReDeclaring(lineGroup, pushed) {
  const form = createForm(
    { orders: record(group({ ref: field(""), lines: array(lineGroup) })) },
    { devWarnings: false },
  );
  try {
    form.f.orders.upsert("a", { ref: "first", lines: [] });
    form.f.orders.row("a").lines.push(pushed);
    const before = form.getValue().orders.a.lines.length;
    form.f.orders.upsert("a", { ref: "second", lines: [] });
    return { before, after: form.getValue().orders.a.lines };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["COL-001", "COL-005", "COL-007"],
    title: "re-declaring a row with no lines leaves no lines",
    environments: ["node"],
  },
  async (ctx) => {
    const shapes = [
      ["one text cell", group({ sku: field("") }), { sku: "S1" }],
      ["two text cells", group({ sku: field(""), note: field("") }), { sku: "S1", note: "N" }],
      ["a text cell and a nested list", group({ sku: field(""), allocations: array(group({ bin: field("") })) }), { sku: "S1", allocations: [] }],
      ["a text cell and a nested map", group({ sku: field(""), allocations: record(group({ bin: field("") })) }), { sku: "S1", allocations: {} }],
      ["nothing but a nested list", group({ allocations: array(group({ bin: field("") })) }), { allocations: [] }],
    ];

    const survived = [];
    for (const [what, lineGroup, pushed] of shapes) {
      const { before, after } = afterReDeclaring(lineGroup, pushed);
      ctx.log.note("a row re-declared away", { what, before, after });

      // The premise for each shape: the line was really there before the re-declare.
      expectEqual(before, 1, {
        claimIds: ["COL-001"],
        what: `a line of ${what} was not added, so re-declaring it away proves nothing`,
      });

      if (after.length > 0) survived.push({ what, after });
    }

    expectEqual(survived, [], {
      claimIds: ["COL-005", "COL-007"],
      what: "a row survived a re-declare that said its collection is empty — and the shapes it survives in are the ones carrying a collection of their own",
      detail: JSON.stringify(survived),
    });
  },
);

battle(
  {
    claims: ["COL-007", "VAL-004"],
    title: "a row that stays holds values its fields can hold",
    environments: ["node"],
  },
  async (ctx) => {
    // The second half, and it stands whichever way the first is resolved: if a row is going to
    // survive, what it holds has to be something the form could have produced. A text cell holds `""`
    // everywhere else in the engine.
    const { after } = afterReDeclaring(
      group({ sku: field(""), allocations: array(group({ bin: field("") })) }),
      { sku: "S1", allocations: [] },
    );
    ctx.log.note("what the surviving row holds", { after });

    const nulls = after.filter((row) => row.sku === null);
    expectEqual(nulls, [], {
      claimIds: ["VAL-004"],
      what: "a surviving row's text cell holds null, which is not a value a text field holds anywhere else",
      detail: JSON.stringify(after),
    });
  },
);
