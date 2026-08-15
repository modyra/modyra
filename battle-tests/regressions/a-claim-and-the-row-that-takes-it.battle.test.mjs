/**
 * A claim waiting for its row, and the row that takes it.
 *
 * A consumer may disable a path before any row occupies it. What happens next is one rule, and ADR
 * 0044 states most of it: what a binder said about a cell travels with the row, and is released when
 * that row ends. The sentence that was missing is where the claim starts — **it is taken by the first
 * row that arrives at the path**, and from then on it belongs to that row like anything else the row
 * carries.
 *
 * One rule explains every sequence, including the pair this file was first written about:
 *
 *   setDisabled, reset, insert                 → the row arrives disabled — no row ever took the claim
 *   setDisabled, setAll, reset, insert         → the row arrives enabled — a row took it and then ended
 *
 * Those two differ because their histories differ, not because the engine has two rules. The first
 * assertion here was that they must agree, and that was wrong: under one rule they must not.
 *
 * What is asserted instead is the rule itself, which is stronger — it fails if the engine ever stops
 * handing a waiting claim to the first row, and it fails if the claim ever stops travelling with that
 * row or stops ending with it.
 *
 * Measured across six sequences: a `setAll` that keeps a row keeps the claim on it; a `setAll` that
 * empties the collection ends both; `remove` then `push` gives a new row that is not disabled. `reset`
 * is not the discriminator — a `setAll` alone does the same thing.
 */

import { array, createForm, field, group } from "@modyra/core";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const items = () => createForm({ items: array(group({ sku: field(""), note: field("") })) }, { devWarnings: false });

/** Which cells report themselves disabled, as `index.cell`. */
function disabledCells(form) {
  const found = [];
  for (let index = 0; index < form.f.items.length(); index += 1) {
    for (const cell of ["sku", "note"]) {
      if (form.f.items.at(index)?.[cell]?.disabled?.() === true) found.push(`${index}.${cell}`);
    }
  }
  return found;
}

battle(
  {
    claims: ["COL-008", "VAL-002"],
    title: "a claim made before the row is one the row arrives with",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the behaviour the rest is measured against: a claim waiting for a path is
    // applied to the row that arrives there.
    const waiting = items();
    try {
      waiting.setDisabled("items.0.note", () => true);
      waiting.f.items.insert(0, { sku: "A1", note: "A1" });
      ctx.log.note("a claim waiting for its row", { disabled: disabledCells(waiting) });

      expectEqual(disabledCells(waiting), ["0.note"], {
        claimIds: ["COL-008"],
        what: "a claim made before the row was not applied when the row arrived, so the pair below is not about a reset",
      });
    } finally {
      waiting.destroy();
    }

    // And it belongs to the row rather than to the index — ADR 0044, asserted so a change there shows
    // up as itself rather than as a surprise inside this battle.
    const travelling = items();
    try {
      travelling.setDisabled("items.0.note", () => true);
      travelling.f.items.setAll([{ sku: "", note: "x" }, { sku: "y", note: "z" }]);
      travelling.f.items.insert(0, { sku: "A1", note: "A1" });
      ctx.log.note("the same claim after a row is inserted above it", { disabled: disabledCells(travelling) });

      expectEqual(disabledCells(travelling), ["1.note"], {
        claimIds: ["COL-008"],
        what: "a claim that had landed on a row did not travel with that row when another was inserted above it",
      });
    } finally {
      travelling.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-008", "VAL-002"],
    title: "a waiting claim is taken by the first row and follows it",
    environments: ["node"],
  },
  async (ctx) => {
    const form = items();
    try {
      form.setDisabled("items.0.note", () => true);

      // Taken: the first row to arrive at the path carries it.
      form.f.items.setAll([{ sku: "", note: "a" }]);
      expectEqual(disabledCells(form), ["0.note"], {
        claimIds: ["COL-008"],
        what: "a row arriving at a path with a waiting claim did not take it",
      });

      // Followed: it belongs to that row, so inserting above moves it down.
      form.f.items.insert(0, { sku: "", note: "new" });
      ctx.log.note("a row inserted above the one that took the claim", { disabled: disabledCells(form) });
      expectEqual(disabledCells(form), ["1.note"], {
        claimIds: ["COL-008", "VAL-002"],
        what: "the claim stayed at the index instead of moving with the row that took it",
      });

      // Ended: when that row ends, so does the claim, and a later row does not inherit it.
      form.f.items.remove(1);
      expectEqual(disabledCells(form), [], {
        claimIds: ["COL-008"],
        what: "the claim outlived the row that held it",
      });

      form.f.items.push({ sku: "", note: "later" });
      ctx.log.note("a row arriving after the holder ended", { disabled: disabledCells(form) });
      expectEqual(disabledCells(form), [], {
        claimIds: ["COL-008", "VAL-002"],
        what: "a claim that ended with its row was handed to the next row to arrive",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-008", "VAL-002"],
    title: "what keeps a claim and what ends it is whether the row survives",
    environments: ["node"],
  },
  async (ctx) => {
    // The six sequences that separate the rule from `reset`. `reset` is not the discriminator: a
    // `setAll` alone ends a row the same way, and a `setAll` that keeps the row keeps the claim.
    const sequences = [
      ["setAll one row", (form) => form.f.items.setAll([{ sku: "", note: "a" }]), ["0.note"]],
      ["setAll one, then one again", (form) => {
        form.f.items.setAll([{ sku: "", note: "a" }]);
        form.f.items.setAll([{ sku: "", note: "b" }]);
      }, ["0.note"]],
      ["setAll one, then two", (form) => {
        form.f.items.setAll([{ sku: "", note: "a" }]);
        form.f.items.setAll([{ sku: "", note: "b" }, { sku: "", note: "c" }]);
      }, ["0.note"]],
      ["setAll one, then empty", (form) => {
        form.f.items.setAll([{ sku: "", note: "a" }]);
        form.f.items.setAll([]);
      }, []],
      ["setAll one, empty, then one again", (form) => {
        form.f.items.setAll([{ sku: "", note: "a" }]);
        form.f.items.setAll([]);
        form.f.items.setAll([{ sku: "", note: "d" }]);
      }, []],
      ["setAll one, remove, then push", (form) => {
        form.f.items.setAll([{ sku: "", note: "a" }]);
        form.f.items.remove(0);
        form.f.items.push({ sku: "", note: "e" });
      }, []],
    ];

    const wrong = [];
    for (const [what, act, expected] of sequences) {
      const form = items();
      form.setDisabled("items.0.note", () => true);
      act(form);
      const seen = disabledCells(form);
      form.destroy();
      if (JSON.stringify(seen) !== JSON.stringify(expected)) wrong.push({ what, expected, seen });
    }
    ctx.log.note("six histories under one rule", { wrong });

    expectEqual(wrong, [], {
      claimIds: ["COL-008", "VAL-002"],
      what: "a claim survived or ended for a reason other than whether the row holding it survived",
    });
  },
);
