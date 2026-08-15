/**
 * A control that is still on screen, holding a claim the engine has already forgotten.
 *
 * ADR 0044 decides what happens to a binding when the row under it ends: it is released *when the
 * row that held it ends and nothing is bound there* — and it names both things that keep it alive,
 * "a claim, or a claim waiting for its row". A claim made before the row exists is not a lesser
 * claim; the same paragraph is why `setDisabled` on a path with no row waits instead of failing.
 *
 * Claims are counted, which the engine gets right: two controls on one path are two claims, and one
 * `removeField` leaves the other still bound. What a whole-value write does to them is where it
 * comes apart. `setAll` ends every row that was there, and a claim made *after* the row survives it
 * — but a claim made while the collection was empty does not. The count is then one short, so the
 * next `removeField` releases a claim that a mounted control still holds.
 *
 * The consequence is a payload. With no claim left, the next binding on that path is released the
 * moment a whole-value write ends its row, and a cell the consumer took out of the submission is
 * sent — the integrity failure ADR 0044 exists to prevent, reached by a different route than the
 * renames and moves it closes.
 *
 * The pair that locates it, with the same claim count and the same whole-value write on both sides:
 *
 *     mount (no row yet), push, mount, setAll [], unmount, push   → the claim is gone
 *     push, mount, mount, setAll [], unmount, push                → one claim is left, as it should be
 *
 * Two claims and one release, either way. The only difference is whether the *first* mount happened
 * before the row existed, and that is the one a whole-value write releases.
 *
 * Found by the positional campaign at 250,000 runs, seed 808017, run 8363, minimised from 24
 * operations to 9, and re-derived from the pair above after a neighbouring finding in this area
 * turned out to be the reference model rather than the engine. This one is not: the pair differs in
 * nothing a claim count can see.
 */

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";
import { POSITIONAL_ROWS_SPEC } from "../../models/schemas.mjs";

const PATH = "items.0.code";

/** Which rows would submit without their `code` cell. */
function excluded(form) {
  const submitted = form.submitValue().items ?? [];
  return (form.getValue().items ?? []).flatMap((_, index) => ("code" in (submitted[index] ?? {}) ? [] : [index]));
}

battle(
  {
    claims: ["VAL-002", "COL-001", "COL-008", "SUB-001"],
    title: "a claim made before the row survives the row being replaced",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases"],
  },
  async (ctx) => {
    const context = ctx.open(POSITIONAL_ROWS_SPEC);

    // One control binds before anything is there — a renderer that mounts its first row's cell
    // while the collection is still empty. ADR 0044 calls this a claim waiting for its row.
    await context.execute({ type: "mount", paths: [PATH] });
    await context.execute({ type: "array.push", path: "items", value: { code: "A", note: "first" } });

    // A second control binds the same path, so two claims are held.
    await context.execute({ type: "mount", paths: [PATH] });

    // A whole-value write ends the row. Both controls are still mounted.
    await context.execute({ type: "array.setAll", path: "items", value: [] });

    // One of the two goes away. The other is still bound, so a claim must remain.
    await context.execute({ type: "unmount", paths: [PATH] });
    await context.execute({ type: "array.push", path: "items", value: { code: "B", note: "second" } });

    // The consumer excludes the cell from the payload, and the row is replaced once more. The claim
    // that is still held is what has to keep the exclusion alive for the row that arrives next.
    await context.execute({ type: "field.disable", path: PATH });
    await context.execute({ type: "array.setAll", path: "items", value: [] });
    await context.execute({ type: "array.push", path: "items", value: { code: "C", note: "third" } });

    const missing = excluded(context.form);
    ctx.log.note("which rows submit without the excluded cell", {
      missing,
      submitted: context.form.submitValue().items,
    });

    expectEqual(missing, [0], {
      claimIds: ["VAL-002", "COL-001", "COL-008", "SUB-001"],
      what: "a cell the consumer excluded is in the payload, because the claim holding it was released while its control was still bound",
      detail: JSON.stringify(context.form.submitValue().items),
    });
  },
);

battle(
  {
    claims: ["COL-001", "VAL-002"],
    title: "the same two claims survive when neither of them waited for a row",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases"],
  },
  async (ctx) => {
    const context = ctx.open(POSITIONAL_ROWS_SPEC);

    // The control on the battle above: the same counts, the same whole-value writes, the same single
    // release — with both claims made after the row exists. If this one ever goes red, the finding
    // is about counting claims rather than about the one that waited.
    await context.execute({ type: "array.push", path: "items", value: { code: "A", note: "first" } });
    await context.execute({ type: "mount", paths: [PATH] });
    await context.execute({ type: "mount", paths: [PATH] });
    await context.execute({ type: "array.setAll", path: "items", value: [] });
    await context.execute({ type: "unmount", paths: [PATH] });
    await context.execute({ type: "array.push", path: "items", value: { code: "B", note: "second" } });
    await context.execute({ type: "field.disable", path: PATH });
    await context.execute({ type: "array.setAll", path: "items", value: [] });
    await context.execute({ type: "array.push", path: "items", value: { code: "C", note: "third" } });

    const missing = excluded(context.form);
    ctx.log.note("two claims, neither of them waiting for a row", { missing });

    expectEqual(missing, [0], {
      claimIds: ["COL-001", "VAL-002"],
      what: "two claims made after the row did not survive one release across a whole-value write",
      detail: JSON.stringify(context.form.submitValue().items),
    });
  },
);
