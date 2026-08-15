/**
 * Where a row comes back when you take something back.
 *
 * Undo is a move to a state the collection was in, and the order the rows were in is part of that
 * state. Three operations are enough to see it, and the shortest one needs no rename at all:
 *
 *   upsert a, upsert b, upsert c, remove a, undo   →   ["b", "c", "a"]
 *
 * The row that comes back arrives at the end. So does one brought back by undoing a rename, and so
 * does one carried forward by a redo. A person who removes the first row of a table and presses undo
 * gets their row back at the bottom.
 *
 * This is the same shape as a renamed row moving to the end, in the path that restores a past rather
 * than the one that renames. That one is closed: a rename now keeps the row where it was, in `keys()`
 * and in the value alike. This one is what the generative campaign found next, and it needed the
 * reference model to stop making the same assumption before it could be seen — a model that also put
 * a restored row last agreed with the engine for the wrong reason.
 *
 * The bulk-write battle next door asks a larger version of this question. This one is the reduction:
 * one row, one removal, one undo.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const rows = () => createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false, history: true });

/** Three rows in the order a person entered them. */
function three(form) {
  for (const key of ["a", "b", "c"]) form.f.rows.upsert(key, { code: key });
  return form;
}

battle(
  {
    claims: ["PER-002", "COL-004"],
    title: "undoing a removal puts the row back where it was",
    environments: ["node"],
  },
  async (ctx) => {
    const form = three(rows());
    try {
      // The control: history recorded the removal, so the undo below is undoing something.
      form.f.rows.remove("a");
      expectEqual(form.f.rows.keys(), ["b", "c"], {
        claimIds: ["COL-004"],
        what: "removing the first row did not remove it",
      });
      expectClaim(form.canUndo(), {
        claimIds: ["PER-002"],
        what: "removing a row recorded nothing to undo",
      });

      form.undo();
      ctx.log.note("a removed row, brought back", { keys: form.f.rows.keys(), value: Object.keys(form.getValue().rows) });

      expectEqual(form.f.rows.keys(), ["a", "b", "c"], {
        claimIds: ["PER-002", "COL-004"],
        what: "a row brought back by an undo arrived at the end rather than where it was",
      });

      // And the value agrees with the handle, so this is one order and not two.
      expectEqual(Object.keys(form.getValue().rows), form.f.rows.keys(), {
        claimIds: ["COL-004"],
        what: "the value and the handle disagree about where the restored row is",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["PER-002", "COL-004"],
    title: "undoing and redoing a rename leave the row where each state had it",
    environments: ["node"],
  },
  async (ctx) => {
    const form = rows();
    try {
      form.f.rows.upsert("a", { code: "a" });
      form.f.rows.upsert("b", { code: "b" });
      form.f.rows.rename("a", "z");

      // The control, and it is the fix that closed the rename: the renamed row stays first.
      expectEqual(form.f.rows.keys(), ["z", "b"], {
        claimIds: ["COL-004"],
        what: "a rename moved the row, which is a different finding and closes before this one",
      });

      form.undo();
      ctx.log.note("a rename, undone", { keys: form.f.rows.keys() });
      expectEqual(form.f.rows.keys(), ["a", "b"], {
        claimIds: ["PER-002", "COL-004"],
        what: "undoing a rename brought the row back at the end instead of where it was",
      });

      form.redo();
      ctx.log.note("and redone", { keys: form.f.rows.keys() });
      expectEqual(form.f.rows.keys(), ["z", "b"], {
        claimIds: ["PER-002", "COL-004"],
        what: "redoing a rename did not return the collection to the state the redo is of",
      });
    } finally {
      form.destroy();
    }
  },
);
