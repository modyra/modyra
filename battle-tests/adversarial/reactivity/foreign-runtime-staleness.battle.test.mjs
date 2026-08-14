/**
 * What a foreign runtime actually costs, measured against a second real one.
 *
 * `cross-runtime-observation` attacks the diagnostic: whether a mismatch is named. This attacks the
 * harm the diagnostic exists to warn about — that a handle observed through a runtime that does not
 * own it stops changing, while the value behind it keeps moving, and nothing says so.
 *
 * It cannot be shown with two vanilla runtimes. Vanilla's tracking is global to the module, so two
 * instances of it see each other's dependencies and the wrong binding keeps working by accident —
 * which is precisely why the defect survived long enough to need a registry. A second runtime with
 * tracking of its own is the only way to make the staleness observable, so this battle builds the
 * form on `@modyra/vue` and observes it through vanilla.
 *
 * Vue rather than Angular because `@modyra/vue`'s reactivity is plain JavaScript and is built by
 * `build:packages`, which is what `npm run battle` runs; Angular's is built separately by
 * `build:angular` and would make the suite's own build a different one.
 *
 * The positive control is half the battle: the owning runtime must see the change the foreign one
 * missed. Without it, a form whose signals had simply stopped emitting would look like a pass.
 */

import { createForm, field, group, observerFor, record, vanillaReactivity } from "@modyra/core";
import { vueReactivity } from "@modyra/vue";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/**
 * Record what an effect sees, through whichever runtime is handed in.
 *
 * The reads go through the public handle, so the two runtimes are asked the same question about the
 * same object and only the observer differs.
 */
function watchThrough(rx, read) {
  const seen = [];
  rx.effect(() => {
    seen.push(read());
  });
  return seen;
}

async function settle(...runtimes) {
  for (const rx of runtimes) await rx.flush?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

battle(
  {
    claims: ["REA-001"],
    title: "a handle observed through a foreign runtime stops changing, and its owner does not",
    environments: ["node"],
  },
  async (ctx) => {
    const owner = vueReactivity();
    const foreign = vanillaReactivity();
    const form = createForm({ name: field("start"), rows: record(group({ code: field("") })) }, {
      reactivity: owner,
      devWarnings: false,
    });

    try {
      form.f.rows.upsert("a", { code: "A" });
      ctx.log.note("a form owned by one runtime, watched by two", {
        owner: owner.kind,
        foreign: foreign.kind,
      });

      const byForeign = watchThrough(foreign, () => form.f.name.value());
      const byOwner = watchThrough(observerFor(form.f.name), () => form.f.name.value());
      const keysByForeign = watchThrough(foreign, () => form.f.rows.keys().join(","));
      const keysByOwner = watchThrough(observerFor(form.f.rows), () => form.f.rows.keys().join(","));

      await settle(owner, foreign);

      form.f.name.set("changed");
      form.f.rows.upsert("b", { code: "B" });
      await settle(owner, foreign);

      // The control, first: the runtime that owns the handle sees what happened. If this fails the
      // battle proves nothing about foreignness — it proves the form stopped emitting.
      expectClaim(byOwner.includes("changed"), {
        claimIds: ["REA-001"],
        what: "the owning runtime sees the write",
        detail: `owner saw ${JSON.stringify(byOwner)}, value is ${JSON.stringify(form.f.name.value())}`,
      });

      expectClaim(keysByOwner.includes("a,b"), {
        claimIds: ["REA-001"],
        what: "the owning runtime sees the row that was declared",
        detail: `owner saw ${JSON.stringify(keysByOwner)}, keys are ${JSON.stringify(form.f.rows.keys())}`,
      });

      // And the harm. The foreign runtime holds a view that no longer matches the form, with no
      // error, no re-run and no way for the binding to know.
      expectClaim(!byForeign.includes("changed"), {
        claimIds: ["REA-001"],
        what: "a foreign runtime observing someone else's handle goes stale without saying so",
        detail: `foreign saw ${JSON.stringify(byForeign)} while the value became ${JSON.stringify(form.f.name.value())}`,
      });

      expectClaim(!keysByForeign.includes("a,b"), {
        claimIds: ["REA-001"],
        what: "a foreign runtime misses a structural change to a collection it is watching",
        detail: `foreign saw ${JSON.stringify(keysByForeign)} while the keys became ${JSON.stringify(form.f.rows.keys())}`,
      });

      // Which is what makes `observerFor` the whole answer: a binding that asks instead of assuming
      // gets the runtime that tracks, without having to know which adapter built the form.
      expectClaim(observerFor(form.f.name) === owner && observerFor(form.f.rows) === owner, {
        claimIds: ["REA-001"],
        what: "asking observerFor is enough to avoid the stale view",
        detail: `field -> ${observerFor(form.f.name).kind}, collection -> ${observerFor(form.f.rows).kind}`,
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["REA-002"],
    title: "the diagnostic names both runtimes when they are genuinely different implementations",
    environments: ["node"],
  },
  async (ctx) => {
    const owner = vueReactivity();
    const foreign = vanillaReactivity();
    const form = createForm({ name: field("start") }, { reactivity: owner, devWarnings: false });

    try {
      const reported = [];
      observerFor(form.f.name, foreign, { report: (entry) => reported.push(entry) });
      ctx.log.note("a vanilla runtime offered for a vue-owned handle", {});

      const entry = reported.find((item) => item.code === "MDY_CROSS_RUNTIME_OBSERVATION") ?? null;
      expectClaim(entry !== null, {
        claimIds: ["REA-002"],
        what: "a mismatch between two real runtimes is reported",
        detail: JSON.stringify(reported.map((item) => item.code)),
      });

      // "The diagnostic names the wrong thing" is the other half of REA-002's break. Two vanilla
      // instances cannot show it — both kinds read `vanilla` and a message naming the wrong one
      // would be indistinguishable from a correct one.
      expectClaim(entry.message.includes("vue") && entry.message.includes("vanilla"), {
        claimIds: ["REA-002"],
        what: "the message names the runtime that owns the handle and the one that asked",
        detail: entry.message,
      });
    } finally {
      form.destroy();
    }
  },
);
