/**
 * A handle taken before the structure moved, read after it.
 *
 * `every-runtime` compares what the form *holds*. It cannot see a defect in what a *handle* answers,
 * because a handle is not part of a canonical observation — and that is a real class: a row handle
 * is built inside its collection's own computation and a cell handle inside whatever the consumer
 * was computing when they asked for it, so on a runtime that owns a computation by the one that
 * created it, the owner re-running can dispose the handle while every value stays right. A disposed
 * computation keeps answering with what it last held, which is `null` when the row's fields were not
 * registered yet.
 *
 * So the comparison here is between runtimes rather than against a model: what a held handle answers
 * is the contract, whichever runtime is underneath, and no model can say what it should be without
 * restating the engine.
 *
 * Solid is the runtime this most wants and the one it cannot reach yet: under the condition where
 * its computations run, taking a row apart raises before a handle can be read at all. It is attacked
 * on its own until that is fixed, so this battle stays about handles.
 */

import { array, createForm, field, group, record, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/**
 * The scenario, written once and given each runtime in turn.
 *
 * As source rather than as a function so it can also be handed to a child process under another
 * export condition when solid can take part. A second spelling of it would compare two scenarios
 * rather than two runtimes.
 */
const SCENARIO = `
const schema = { orders: record(group({ ref: field(""), lines: array(group({ sku: field("") })) })) };
const form = createForm(schema, { reactivity, devWarnings: false });
form.f.orders.upsert("o1", { ref: "R", lines: [{ sku: "S1" }, { sku: "S2" }] });
form.f.orders.upsert("o2", { ref: "R2", lines: [{ sku: "T1" }] });

// Every shape a consumer holds on to, taken before anything moves.
const cell = form.f.orders.row("o1").lines.at(0).sku;
const row = form.f.orders.row("o1");
const list = form.f.orders.row("o1").lines;

const read = (label) => ({
  label,
  cell: cell.value() ?? null,
  rowRef: row?.ref?.value() ?? null,
  length: typeof list?.length === "function" ? list.length() : null,
});

const answers = [read("held")];
form.f.orders.row("o1").lines.move(0, 1);
answers.push(read("after the list moved under it"));
form.f.orders.rename("o1", "o9");
answers.push(read("after the row was renamed"));
form.f.orders.remove("o2");
answers.push(read("after a sibling row was removed"));

result = { answers, value: form.getValue().orders };
form.destroy();
`;

/** Run the scenario here, on a runtime this process can load. */
function inProcess(reactivity) {
  const scope = { array, createForm, field, group, record, reactivity, result: null };
  const run = new Function(
    "array", "createForm", "field", "group", "record", "reactivity",
    `let result; ${SCENARIO} return result;`,
  );
  return run(scope.array, scope.createForm, scope.field, scope.group, scope.record, scope.reactivity);
}


const RUNTIMES = Object.freeze([
  ["vue", async () => (await import("@modyra/vue")).vueReactivity()],
  ["react", async () => (await import("@modyra/react")).reactReactivity()],
  ["preact", async () => (await import("@modyra/preact")).preactReactivity()],
  ["svelte", async () => (await import("@modyra/svelte")).svelteReactivity()],
  ["lit", async () => (await import("@modyra/lit")).litReactivity()],
  ["solid", async () => (await import("@modyra/solid")).solidReactivity()],
]);

battle(
  {
    claims: ["REA-001", "COL-006", "COL-007"],
    title: "a handle held across a structural change answers the same on every runtime",
    environments: ["node"],
  },
  async (ctx) => {
    const baseline = inProcess(vanillaReactivity());
    ctx.log.note("what a held handle answers on vanilla", { answers: baseline.answers });

    // The control: the handles have to have answered something that changed, or every runtime
    // agrees about a scenario in which nothing was held across anything.
    expectClaim(baseline.answers[0].cell === "S1" && baseline.answers[1].cell === "S2", {
      claimIds: ["COL-006"],
      what: "the held cell did not follow the position it was taken at",
      detail: JSON.stringify(baseline.answers.map((each) => each.cell)),
    });

    expectClaim(baseline.answers[2].cell === null, {
      claimIds: ["COL-007"],
      what: "a handle whose row was renamed away still answers with a value",
      detail: JSON.stringify(baseline.answers[2]),
    });

    for (const [name, load] of RUNTIMES) {
      const reactivity = await load();
      ctx.log.note("the same handles on another runtime", { runtime: name, kind: reactivity.kind });

      expectClaim(reactivity.kind === name, {
        claimIds: ["REA-001"],
        what: `@modyra/${name} supplied a runtime of its own kind`,
        detail: `kind=${reactivity.kind}`,
      });

      const observed = inProcess(reactivity);
      expectEqual(observed.answers, baseline.answers, {
        claimIds: ["REA-001", "COL-006", "COL-007"],
        what: `a handle held across the same changes answered differently on ${name}`,
      });

      expectEqual(observed.value, baseline.value, {
        claimIds: ["REA-001"],
        what: `the form itself ended differently on ${name}`,
      });
    }

    // Solid is the runtime where a handle can be owned by the computation that built it, so it is
    // the one this comparison most wants, and it takes part now. It could not before for two
    // reasons that have both been removed: declaring a nested two-cell row raised, and without the
    // `browser` export condition its computations never re-ran, which froze every verdict. Neither
    // is true here — the scenario runs to completion on both builds and the answers agree.
    ctx.log.note("solid takes part in the comparison it was most wanted for", {});
  },
);
