/**
 * A row whose shape depends on what the row says about itself.
 *
 * A section inside a row is the one place a cell can be absent for two unrelated reasons at once:
 * nobody mounted it, and the row it belongs to does not have it. `VAL-003` says the first must not
 * matter and `COL-003` says validity is independent of what is on screen — but neither has ever been
 * attacked against a shape where the second reason exists, because the suite's fixtures had no
 * conditional section in them.
 *
 * The branch carries a required cell, so an inactive section holding an unsatisfied requirement is
 * reachable: the shape most likely to make a form unsubmittable for a reason no control can show.
 *
 * What is under attack is not that conditions work. It is that a condition and a mount are
 * independent — that the same operations reach the same form whether or not anyone was looking at
 * the branch, and that the branch's own state survives the row changing identity underneath it.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { CONDITIONAL_ROWS_SPEC } from "../../models/schemas.mjs";

/** Open the branch, fill it, close it again — the round trip a consumer makes with a radio group. */
const THROUGH_THE_BRANCH = Object.freeze([
  { type: "record.upsert", path: "rows", key: "a", value: { tier: "basic" } },
  { type: "record.upsert", path: "rows", key: "b", value: { tier: "full" } },
  { type: "field.set", path: "rows.b.extras.reference", value: "R1" },
  { type: "field.touch", path: "rows.b.extras.memo" },
  { type: "field.set", path: "rows.a.tier", value: "full" },
  { type: "field.set", path: "rows.a.extras.reference", value: "R2" },
  { type: "field.set", path: "rows.a.tier", value: "basic" },
]);

battle(
  {
    claims: ["VAL-003", "COL-003"],
    title: "a conditional branch means the same thing whether or not it is on screen",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "observations"],
  },
  async (ctx) => {
    const unwatched = ctx.open(CONDITIONAL_ROWS_SPEC);
    const watched = ctx.open(CONDITIONAL_ROWS_SPEC);

    for (const operation of THROUGH_THE_BRANCH) await unwatched.execute(operation);
    await unwatched.scheduler.flush();

    // The same log, with controls held on the branch throughout — including while it is inactive,
    // which is what a renderer that keeps its subtree alive across a toggle actually does.
    await watched.execute({ type: "mount", paths: ["rows.a.extras.reference", "rows.b.extras.memo"] });
    for (const operation of THROUGH_THE_BRANCH) await watched.execute(operation);
    await watched.scheduler.flush();

    const withoutControls = unwatched.observe("branch never mounted");
    const withControls = watched.observe("branch mounted throughout");

    // The control: the sequence has to have left an inactive branch and an active one behind, or
    // the two forms agree about a shape neither of them has.
    expectClaim(withoutControls.collections[0].keys.length === 2, {
      claimIds: ["COL-003"],
      what: "the sequence left both a basic row and a full one",
      detail: JSON.stringify(withoutControls.collections[0].keys),
    });

    expectSameObservation(withControls, withoutControls, {
      claimIds: ["VAL-003", "COL-003"],
      ignore: [...RENDERER_ONLY_FIELDS],
      what: "holding controls on a conditional branch changed the form",
    });
  },
);

battle(
  {
    claims: ["VAL-003", "SUB-001"],
    title: "an unsatisfied requirement inside a closed branch does not decide the form",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(CONDITIONAL_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { tier: "basic" } });
    await context.scheduler.flush();

    // The branch is closed and its required cell is empty. A form that counted it would be
    // unsubmittable with nothing on screen to explain why.
    expectClaim(context.form.state.valid(), {
      claimIds: ["VAL-003"],
      what: "a requirement inside a closed branch does not make the form invalid",
      detail: JSON.stringify(context.form.submitValue()),
    });

    expectClaim(!("extras" in context.form.submitValue().rows.a), {
      claimIds: ["SUB-001"],
      what: "a closed branch contributes no path to the payload",
      detail: JSON.stringify(context.form.submitValue().rows.a),
    });

    await context.execute({ type: "field.set", path: "rows.a.tier", value: "full" });
    await context.scheduler.flush();

    // And the positive control: opening the branch does make the requirement count. Without this,
    // a form that had stopped evaluating the branch entirely would satisfy the assertion above.
    expectClaim(!context.form.state.valid(), {
      claimIds: ["VAL-003"],
      what: "opening the branch makes its unsatisfied requirement count",
      detail: JSON.stringify(context.form.submitValue().rows.a),
    });
  },
);

battle(
  {
    claims: ["COL-007", "VAL-003"],
    title: "a renamed row keeps the branch it had open and what was in it",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(CONDITIONAL_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { tier: "full" } });
    await context.execute({ type: "field.set", path: "rows.a.extras.reference", value: "R1" });
    await context.execute({ type: "field.touch", path: "rows.a.extras.memo" });
    await context.scheduler.flush();

    const before = context.form.submitValue().rows.a;

    await context.execute({ type: "record.rename", path: "rows", from: "a", to: "z" });
    await context.scheduler.flush();

    const after = context.form.submitValue().rows.z;

    expectClaim(JSON.stringify(after) === JSON.stringify(before), {
      claimIds: ["COL-007"],
      what: "the renamed row submits the open branch it had before",
      detail: `was ${JSON.stringify(before)}, is ${JSON.stringify(after)}`,
    });

    // The branch is state of the row as much as a cell is, so the mark inside it travels too.
    expectClaim(context.form.getField("rows.z.extras.memo")?.().touched() === true, {
      claimIds: ["COL-007", "VAL-003"],
      what: "a mark made inside the branch survives the rename",
      detail: JSON.stringify(after),
    });
  },
);
