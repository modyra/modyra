/**
 * The same operations on two reactivity runtimes, compared as a consumer sees them.
 *
 * Every collection, validation and submission claim in this suite is proven on the vanilla graph.
 * That is one implementation of the reactive contract out of eight, and the one whose tracking is
 * global to the module — the most forgiving of the set. A rule that holds because vanilla is lenient
 * is not a rule the framework keeps.
 *
 * So the same operation log is driven through a form built on `vanillaReactivity` and one built on
 * `@modyra/vue`, and their canonical observations are compared. Nothing about scheduling is asserted
 * here: the two runtimes flush differently and are allowed to, which is why both are settled before
 * anything is read. What may not differ is what the form holds, what it will submit, which rows it
 * has, what is invalid, and which cells carry a mark.
 *
 * `mountedPaths` is excluded and nothing else, because the two contexts mount the same paths and a
 * wider exclusion is how a differential stops testing anything.
 */

import { vueReactivity } from "@modyra/vue";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

/**
 * A hostile-but-legal sequence: rows arrive, are marked, are taken out of the payload, change
 * identity, and one of them leaves while a control still holds it.
 */
const SEQUENCE = Object.freeze([
  { type: "record.upsert", path: "rows", key: "a", value: { code: "A1", note: "first" } },
  { type: "record.upsert", path: "rows", key: "b", value: { code: "", note: "second" } },
  { type: "mount", paths: ["rows.a.code", "rows.b.code"] },
  { type: "field.touch", path: "rows.a.note" },
  { type: "field.dirty", path: "rows.b.note" },
  { type: "field.disable", path: "rows.a.code" },
  { type: "record.upsert", path: "rows", key: "c" },
  // The rename happens under a mark and under an exclusion, which is where the two runtimes have
  // the most room to disagree: both have to move the row's state, not merely its value.
  { type: "record.rename", path: "rows", from: "b", to: "d" },
  { type: "field.set", path: "rows.d.note", value: "renamed" },
  { type: "field.touch", path: "rows.d.code" },
  { type: "field.disable", path: "rows.c.note" },
  // `a` leaves while a control still holds one of its cells — the row ends, the claim does not.
  { type: "record.remove", path: "rows", key: "a" },
  { type: "unmount", paths: ["rows.b.code"] },
  { type: "record.patch", path: "rows", value: { d: { code: "D1" } } },
]);

async function drive(context) {
  for (const operation of SEQUENCE) await context.execute(operation);
  await context.scheduler.flush();
  // Vue schedules its own effects; a macrotask lets both runtimes finish before anything is read,
  // so a difference in when they settle cannot be mistaken for a difference in what they hold.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return context.observe("after the sequence");
}

battle(
  {
    claims: ["COL-001", "COL-007", "VAL-002", "SUB-001", "SUB-002"],
    title: "a form means the same thing on vue's reactivity as on vanilla's",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const onVanilla = ctx.open(KEYED_ROWS_SPEC);
    const onVue = ctx.open(KEYED_ROWS_SPEC, { reactivity: vueReactivity() });

    const vanillaState = await drive(onVanilla);
    const vueState = await drive(onVue);

    // The control: a sequence that ended with nothing declared would compare two empty forms and
    // agree perfectly. What the operations were for has to be visible in what they produced.
    expectClaim(vanillaState.collections[0].keys.length > 0, {
      claimIds: ["COL-001"],
      what: "the sequence left rows behind to compare",
      detail: JSON.stringify(vanillaState.collections[0].keys),
    });

    expectClaim(vanillaState.disabledPaths.length > 0 && vanillaState.touchedPaths.length > 0, {
      claimIds: ["VAL-002"],
      what: "the sequence left interaction state behind to compare",
      detail: `disabled ${JSON.stringify(vanillaState.disabledPaths)}, touched ${JSON.stringify(vanillaState.touchedPaths)}`,
    });

    expectSameObservation(vueState, vanillaState, {
      claimIds: ["COL-001", "COL-007", "VAL-002", "SUB-001", "SUB-002"],
      ignore: [...RENDERER_ONLY_FIELDS],
      what: "the same operations on vue's reactivity produced a different form",
    });
  },
);
