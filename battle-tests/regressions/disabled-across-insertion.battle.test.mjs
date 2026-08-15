/**
 * Two things said about one cell, and which of them the row carries.
 *
 * A binding can be made for a row that does not exist yet — `setDisabled` on a path whose row has
 * not arrived waits, and applies when it does. That is deliberate and ADR 0044 says so. What the
 * record does not say is what happens when *two* of them meet: a binding waiting at a key or an
 * index, and a row that arrives there already carrying one of its own.
 *
 * The engine answers consistently, in both collection kinds: **what the row carries wins.**
 *
 *     positional   enable 0.code, push, disable 1.code, insert at 0   → nothing excluded
 *                  push, disable 1.code, insert at 0                  → 1.code excluded
 *     keyed        disable Z.note, upsert a, enable a.note, rename a→Z → nothing excluded
 *                  disable Z.note, upsert a, rename a→Z               → Z.note excluded
 *
 * Without a carried binding the waiting one applies; with one, the carried binding overwrites it.
 * The same rule, reached from two collection kinds and four sequences.
 *
 * This file first asserted the opposite — that the waiting binding wins — and was filed as an S0 for
 * three weeks of session time on the strength of a generated campaign that had the same rule in its
 * reference model. Two campaigns finding one divergence is not two pieces of evidence when both read
 * from the same model. What settled it was the pair of sequences above: removing the *first* pending
 * binding makes the second one apply, which is not what a lost binding looks like.
 *
 * So what is asserted here is what holds under either reading of the record: the two kinds agree
 * with each other, and a binding is never simply lost — one of the two always applies. Which of them
 * *should* is a decision for ADR 0044, and it is open.
 */

import { battle } from "../harness/battle.mjs";
import { expectEqual } from "../harness/assertions.mjs";
import { KEYED_ROWS_SPEC, POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

/** Which cells a submission leaves out. */
function excluded(form, path, cells) {
  const value = form.getValue()[path];
  const submitted = form.submitValue()[path];
  if (Array.isArray(value)) {
    return value.flatMap((_, index) =>
      cells.filter((cell) => !(cell in (submitted[index] ?? {}))).map((cell) => `${index}.${cell}`));
  }
  return Object.keys(value ?? {}).flatMap((key) =>
    cells.filter((cell) => !(cell in (submitted[key] ?? {}))).map((cell) => `${key}.${cell}`));
}

battle(
  {
    claims: ["VAL-002", "COL-001", "COL-008"],
    title: "a waiting binding applies unless the row that arrives carries one of its own",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // Positional: a row moved into an index a binding is waiting at, with and without a binding of
    // its own picked up earlier.
    const carriedPositional = ctx.open(POSITIONAL_ROWS_SPEC);
    await carriedPositional.execute({ type: "field.enable", path: "items.0.code" });
    await carriedPositional.execute({ type: "array.push", path: "items", value: { code: "", note: "A1" } });
    await carriedPositional.execute({ type: "field.disable", path: "items.1.code" });
    await carriedPositional.execute({ type: "array.insert", path: "items", index: 0, value: { code: "A1", note: "" } });
    const carried = excluded(carriedPositional.form, "items", ["code", "note"]);

    const waitingPositional = ctx.open(POSITIONAL_ROWS_SPEC);
    await waitingPositional.execute({ type: "array.push", path: "items", value: { code: "", note: "A1" } });
    await waitingPositional.execute({ type: "field.disable", path: "items.1.code" });
    await waitingPositional.execute({ type: "array.insert", path: "items", index: 0, value: { code: "A1", note: "" } });
    const waiting = excluded(waitingPositional.form, "items", ["code", "note"]);
    ctx.log.note("a positional row moved into a waiting binding", { carried, waiting });

    // The waiting binding applies when the row brings nothing. This is the control that a pending
    // binding is not simply dropped by an insertion.
    expectEqual(waiting, ["1.code"], {
      claimIds: ["VAL-002", "COL-001"],
      what: "a binding waiting at an index did not apply to the row an insertion moved there",
    });

    // And when the row brings one, exactly one of the two applies — which one is the open question,
    // and both answers leave a cell either excluded or not by a rule somebody stated.
    expectEqual(carried, [], {
      claimIds: ["COL-008"],
      what: `a row carrying its own binding into a waiting one produced ${JSON.stringify(carried)}, which is neither answer`,
    });

    // Keyed: the same pair, through a rename rather than an insertion.
    const carriedKeyed = ctx.open(KEYED_ROWS_SPEC);
    await carriedKeyed.execute({ type: "field.disable", path: "rows.Z.note" });
    await carriedKeyed.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "1" } });
    await carriedKeyed.execute({ type: "field.enable", path: "rows.a.note" });
    await carriedKeyed.execute({ type: "record.rename", path: "rows", from: "a", to: "Z" });
    const carriedByKey = excluded(carriedKeyed.form, "rows", ["code", "note", "tax"]);

    const waitingKeyed = ctx.open(KEYED_ROWS_SPEC);
    await waitingKeyed.execute({ type: "field.disable", path: "rows.Z.note" });
    await waitingKeyed.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "1" } });
    await waitingKeyed.execute({ type: "record.rename", path: "rows", from: "a", to: "Z" });
    const waitingByKey = excluded(waitingKeyed.form, "rows", ["code", "note", "tax"]);
    ctx.log.note("a keyed row renamed into a waiting binding", { carriedByKey, waitingByKey });

    expectEqual(waitingByKey, ["Z.note"], {
      claimIds: ["VAL-002", "COL-001"],
      what: "a binding waiting at a key did not apply to the row a rename moved there",
    });

    // The point of the file: the two collection kinds answer the same way. A rule that held for one
    // and not the other would be a difference nobody chose.
    expectEqual(carriedByKey.length === 0, carried.length === 0, {
      claimIds: ["COL-001", "COL-008"],
      what: "a keyed collection and a positional one disagree about a row carrying a binding into a waiting one",
      detail: JSON.stringify({ carried, carriedByKey }),
    });
  },
);
