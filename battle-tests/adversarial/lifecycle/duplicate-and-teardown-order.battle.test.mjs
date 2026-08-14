/**
 * Mount patterns the six strategies cannot express.
 *
 * `mount-pattern-equivalence` runs one log under six rules about *how much* is on screen. These are
 * the shapes that are not a rule about quantity: the same cell held by two controls at once, a
 * control released and re-taken on every step, two forms bound to the same names, and the two orders
 * a page can come apart in.
 *
 * They matter because each is something a real renderer does and none is a variation of "more or
 * fewer cells". A table with a sticky first column mounts a cell twice. A virtualised list releases
 * and re-takes on every scroll. A wizard keeps two forms over the same field names. And a page
 * unloading gives no guarantee about whether the renderer or the form goes first.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

const SEQUENCE = Object.freeze([
  { type: "record.upsert", path: "rows", key: "a", value: { code: "A", note: "first" } },
  { type: "record.upsert", path: "rows", key: "b", value: { code: "", note: "second" } },
  { type: "field.set", path: "rows.a.code", value: "edited" },
  // Marked on the row that survives to the end: a mark made on the row that is removed leaves
  // nothing to compare, and the control below is what caught that.
  { type: "field.touch", path: "rows.b.code" },
  { type: "field.dirty", path: "rows.b.note" },
  { type: "field.touch", path: "rows.a.note" },
  { type: "record.rename", path: "rows", from: "b", to: "c" },
  { type: "record.remove", path: "rows", key: "a" },
]);

const HELD = Object.freeze(["rows.a.code", "rows.b.note"]);

battle(
  {
    claims: ["LIF-002", "COL-001", "SUB-001"],
    title: "a cell held by two controls at once means what a cell held by one means",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "observations"],
  },
  async (ctx) => {
    const once = ctx.open(KEYED_ROWS_SPEC);
    const twice = ctx.open(KEYED_ROWS_SPEC);

    await once.execute({ type: "mount", paths: [...HELD] });
    // The same paths claimed a second time, by a control that does not know about the first — a
    // sticky column and a body cell rendering the same field.
    await twice.execute({ type: "mount", paths: [...HELD] });
    await twice.execute({ type: "mount", paths: [...HELD] });

    for (const operation of SEQUENCE) {
      await once.execute(operation);
      await twice.execute(operation);
    }
    await once.scheduler.flush();
    await twice.scheduler.flush();

    const heldOnce = once.observe("each cell held by one control");
    const heldTwice = twice.observe("each cell held by two");

    // The control: the sequence has to have left marks behind, or the two forms agree about a form
    // in which nothing was ever touched or edited.
    expectClaim(heldOnce.touchedPaths.length > 0 && heldOnce.dirtyPaths.length > 0, {
      claimIds: ["LIF-002"],
      what: "the sequence left interaction state to compare",
      detail: `touched ${JSON.stringify(heldOnce.touchedPaths)}, dirty ${JSON.stringify(heldOnce.dirtyPaths)}`,
    });

    // A second control must not double anything: not the write, not the touch, not the dirty flag.
    // Those are set rather than counted, so a doubling shows as a difference in the whole state.
    expectSameObservation(heldTwice, heldOnce, {
      claimIds: ["LIF-002", "COL-001", "SUB-001"],
      ignore: [...RENDERER_ONLY_FIELDS],
      what: "holding a cell twice produced a different form from holding it once",
    });
  },
);

battle(
  {
    claims: ["LIF-002", "COL-006"],
    title: "a control released and re-taken on every step ends where one that never moved ends",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const steady = ctx.open(KEYED_ROWS_SPEC);
    const churning = ctx.open(KEYED_ROWS_SPEC);

    await steady.execute({ type: "mount", paths: [...HELD] });

    for (const operation of SEQUENCE) {
      await steady.execute(operation);

      // A virtualised list: everything is released and re-taken around every change.
      await churning.execute({ type: "mount", paths: [...HELD] });
      await churning.execute(operation);
      await churning.execute({ type: "unmount", paths: [...HELD] });
    }
    await churning.execute({ type: "mount", paths: [...HELD] });
    await steady.scheduler.flush();
    await churning.scheduler.flush();

    const held = steady.observe("held throughout");
    const rebound = churning.observe("released and re-taken on every step");

    expectClaim(held.collections[0].keys.length > 0, {
      claimIds: ["COL-006"],
      what: "the sequence left rows to compare",
      detail: JSON.stringify(held.collections[0].keys),
    });

    expectSameObservation(rebound, held, {
      claimIds: ["LIF-002", "COL-006"],
      ignore: [...RENDERER_ONLY_FIELDS],
      what: "churning the controls changed the form",
    });
  },
);

battle(
  {
    claims: ["COL-001", "SUB-001"],
    title: "two forms bound to the same names do not reach into each other",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "observations"],
  },
  async (ctx) => {
    const alone = ctx.open(KEYED_ROWS_SPEC);
    const left = ctx.open(KEYED_ROWS_SPEC);
    const right = ctx.open(KEYED_ROWS_SPEC);

    await alone.execute({ type: "mount", paths: [...HELD] });
    await left.execute({ type: "mount", paths: [...HELD] });
    await right.execute({ type: "mount", paths: [...HELD] });

    for (const operation of SEQUENCE) {
      await alone.execute(operation);
      await left.execute(operation);
    }

    // The neighbour is driven differently on purpose: if the two share anything, the one that ran
    // the sequence will have picked something up from the one that did not.
    await right.execute({ type: "record.upsert", path: "rows", key: "z", value: { code: "Z" } });
    await right.execute({ type: "field.touch", path: "rows.z.code" });

    await alone.scheduler.flush();
    await left.scheduler.flush();
    await right.scheduler.flush();

    const withoutNeighbour = alone.observe("the same sequence, alone on the page");
    const withNeighbour = left.observe("the same sequence, beside another form");

    expectSameObservation(withNeighbour, withoutNeighbour, {
      claimIds: ["COL-001", "SUB-001"],
      ignore: [...RENDERER_ONLY_FIELDS],
      what: "a second form over the same names changed the first",
    });

    // And the neighbour kept its own row rather than any of the sequence's.
    expectEqual([...right.form.f.rows.keys()], ["z"], {
      claimIds: ["COL-001"],
      what: "the neighbouring form holds only the row it was given",
    });
  },
);

battle(
  {
    claims: ["LIF-001", "LIF-002"],
    title: "a page comes apart in either order without the form noticing",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases"],
  },
  async (ctx) => {
    // Controls released first, then the form destroyed — an unmounting component tree.
    const controlsFirst = ctx.open(KEYED_ROWS_SPEC);
    for (const operation of SEQUENCE) await controlsFirst.execute(operation);
    await controlsFirst.execute({ type: "mount", paths: [...HELD] });
    await controlsFirst.execute({ type: "unmount", paths: [...HELD] });
    const afterRelease = controlsFirst.observe("controls released while the form lives");

    expectClaim(afterRelease.fieldNames.length > 0, {
      claimIds: ["LIF-002"],
      what: "releasing every control did not take the form's fields with it",
      detail: JSON.stringify(afterRelease.fieldNames),
    });

    await controlsFirst.execute({ type: "destroy" });

    // The other order: the form is destroyed while controls are still holding cells, which is what
    // a navigation away does. Releasing afterwards must not raise — a teardown that throws inside a
    // renderer's own cleanup is a page that fails on the way out.
    const formFirst = ctx.open(KEYED_ROWS_SPEC);
    for (const operation of SEQUENCE) await formFirst.execute(operation);
    await formFirst.execute({ type: "mount", paths: [...HELD] });
    await formFirst.execute({ type: "destroy" });

    let raised = null;
    try {
      await formFirst.execute({ type: "unmount", paths: [...HELD] });
    } catch (error) {
      raised = error;
    }

    expectClaim(raised === null, {
      claimIds: ["LIF-001"],
      what: "releasing a control after the form was destroyed raised",
      detail: raised?.message ?? "",
    });
  },
);
