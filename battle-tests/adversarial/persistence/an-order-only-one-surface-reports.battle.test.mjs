/**
 * The order a record reports, and the order its next bulk write uses.
 *
 * `keys()` is documented on the public handle as *"the declared keys, in declaration order"*, and for
 * a record it is the **only** surface that can answer: a value is a plain object, and JavaScript puts
 * an integer-like key ahead of every other one whatever order it was written in. Everything
 * downstream of that order has to be reading the same one.
 *
 * Two operations move a key without adding or removing one — an undo restoring a removed row to its
 * place, and a rename giving a row a new key in the old one's place. `keys()` reports both as done.
 * A `setAll` afterwards reports something else:
 *
 *     nothing moved   before ["5aac", "3"]              after ["5aac", "3", "segment8"]
 *     an undo         before ["5aac", "3"]              after ["3", "5aac", "segment8"]
 *
 *     a rename        before ["tmp:18", "tmp:5", "47"]  after ["47", "tmp:18", "20"]
 *                                                       and not ["tmp:18", "47", "20"]
 *
 * The reported order going in is what the first table's two rows share, and their results differ. So
 * what a bulk write consults is not what `keys()` reports: a survivor keeps its place when nothing
 * moved, and comes back in whatever order the object handed in happened to have when something did.
 *
 * A restore or a rename that leaves one notion of order behind looks complete until the next bulk
 * write, which can be a long way from the operation that caused it.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const FIRST = "5aac0f4c-51c5";
const ADDED = "segment8";
const RENAMED = "tmp:18";

/** Keys chosen so the object cannot carry the order: `"3"` sorts ahead of both, whatever it is given. */
const WRITTEN = Object.freeze({
  "3": { code: "three" },
  [FIRST]: { code: "first" },
  [ADDED]: { code: "added" },
});

/** The same collection written back whole, every key of it one that already exists. */
const RENAMED_WRITE = Object.freeze({ "3": { code: "three" }, [RENAMED]: { code: "first" } });

/**
 * Declare two rows, move one of them, then replace the collection wholesale.
 *
 * `move` is what the collection is asked to do between declaring and writing: `"undo"` restores a
 * removed row to its place, `"rename"` gives a row a new key in the place the old one had, and
 * `"none"` is the same shape with nothing moved.
 */
function declareThenSetAll(move) {
  const form = createForm({ rows: record(group({ code: field("") }), {}) }, { devWarnings: false, history: true });
  form.f.rows.upsert(FIRST, { code: "first" });
  form.f.rows.upsert("3", { code: "three" });
  if (move === "undo") {
    form.f.rows.remove(FIRST);
    form.undo();
  }
  if (move === "rename") {
    form.f.rows.rename(FIRST, RENAMED);
  }
  const before = [...form.f.rows.keys()];
  form.f.rows.setAll(move === "rename" ? { ...RENAMED_WRITE } : { ...WRITTEN });
  const after = [...form.f.rows.keys()];
  form.destroy();
  return { before, after };
}

battle(
  {
    claims: ["PER-002", "COL-002"],
    title: "an undo restores the order a bulk write goes on to use",
    environments: ["node"],
  },
  async (ctx) => {
    const plain = declareThenSetAll("none");
    const undone = declareThenSetAll("undo");
    ctx.log.note("the same bulk write, with and without an undo before it", { plain, undone, written: Object.keys(WRITTEN) });

    // The first control: the undo really did restore the order, which is what makes the difference
    // afterwards a contradiction rather than two different starting points.
    expectEqual(undone.before, plain.before, {
      claimIds: ["PER-002"],
      what: "the undo did not restore the declared order at all, which is a plainer defect than the one this battle is about",
    });

    // The second: the object cannot carry the order, so `keys()` is the only surface that could.
    expectClaim(Object.keys(WRITTEN)[0] === "3" && plain.before[0] === FIRST, {
      claimIds: ["COL-002"],
      what: "the written object happens to agree with the declared order, so this battle cannot tell the two apart",
      detail: JSON.stringify({ written: Object.keys(WRITTEN), declared: plain.before }),
    });

    expectEqual(undone.after, plain.after, {
      claimIds: ["PER-002", "COL-002"],
      what: "a bulk write ordered the surviving rows differently because an undo had happened, so the order restored is not the order the next write consults",
    });
  },
);

battle(
  {
    claims: ["COL-007", "COL-002"],
    title: "a renamed row keeps the place a bulk write gives it",
    environments: ["node"],
  },
  async (ctx) => {
    // The other way a key moves, in the shape the generative campaign reached it: three rows, one of
    // them renamed in place, then a write that keeps two of them and brings one new key.
    const form = createForm({ rows: record(group({ code: field("") }), {}) }, { devWarnings: false });
    form.f.rows.setAll({ "27": { code: "a" }, "tmp:5": { code: "b" } });
    form.f.rows.upsert("47", { code: "c" });
    form.f.rows.rename("27", RENAMED);
    const before = [...form.f.rows.keys()];

    // `"20"` is the new key, and it is integer-like on purpose: the object hands its keys over in an
    // order no author chose, so the only order a bulk write could keep is the one `keys()` reports.
    const written = { "20": { code: "new" }, "47": { code: "c" }, [RENAMED]: { code: "a" } };
    form.f.rows.setAll(written);
    const after = [...form.f.rows.keys()];
    form.destroy();
    ctx.log.note("a renamed row, then a bulk write", { before, after, written: Object.keys(written) });

    // The control: the rename put the new key where the old one was, so `keys()` reports the order
    // this battle then holds the bulk write to.
    expectEqual(before, [RENAMED, "tmp:5", "47"], {
      claimIds: ["COL-007"],
      what: "the rename did not leave the new key in the old key's place, which is a plainer defect than the one this battle is about",
    });

    // Survivors in the order they were declared, then the key that is new.
    expectEqual(after, [RENAMED, "47", "20"], {
      claimIds: ["COL-007", "COL-002"],
      what: "a bulk write ordered the surviving rows differently after a rename, so the order a rename leaves is not the order the next write consults",
    });
  },
);
