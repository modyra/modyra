/**
 * Adding a row at the end says nothing about the rows already there.
 *
 * A positional collection rebuilds its rows on every structural change: it removes all of them and
 * registers them again. From inside that is one atomic operation; from outside it means a control
 * that never moved loses its claim, and what a binder said about a cell — disabled, readonly —
 * goes with it. A cell the consumer disabled is submitted again after a push at the other end of
 * the list.
 *
 * What a structural change *is* documented to do is rebuild the rows it moves clean: touched and
 * dirty do not travel. That is interaction state, and it is not what a binder owns.
 *
 * Found by the generated array campaign, minimised to three operations: insert, disable, push.
 */

import { array, createForm, field, group, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["VAL-002", "SUB-001"],
    title: "a push does not re-enable a disabled cell of another row",
    environments: ["node"],
  },
  async (ctx) => {
    const rx = vanillaReactivity();
    const form = createForm(
      { items: array(group({ sku: field(""), note: field("") })) },
      { reactivity: rx, devWarnings: false },
    );

    try {
      form.f.items.push({ sku: "a", note: "A" });
      form.setDisabled("items.0.note", rx.signal(true));
      ctx.log.note("disabled one cell of the only row", { path: "items.0.note" });

      const before = form.submitValue();
      expectClaim(before.items[0].note === undefined, {
        claimIds: ["VAL-002"],
        what: "the disabled cell is not submitted",
        detail: JSON.stringify(before),
      });

      form.f.items.push({ sku: "b", note: "B" });
      ctx.log.note("pushed a row at the other end", {});

      const after = form.submitValue();
      expectClaim(after.items[0].note === undefined, {
        claimIds: ["VAL-002", "SUB-001"],
        what: "a push at the end leaves the other row's binding alone",
        detail: JSON.stringify(after),
      });
      expectClaim(form.getField("items.0.note")().disabled(), {
        claimIds: ["VAL-002"],
        what: "and the field still reports itself disabled",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["LIF-002"],
    title: "a structural change does not release the claims controls hold",
    environments: ["node"],
    requires: ["mountedPhases"],
  },
  async (ctx) => {
    const context = ctx.open(
      {
        version: 1,
        fields: { items: { kind: "array", of: { sku: { kind: "text" }, note: { kind: "text" } } } },
      },
      { devWarnings: false },
    );

    try {
      await context.execute({ type: "array.push", path: "items", value: { sku: "a", note: "A" } });
      await context.execute({ type: "mount", paths: ["items.0.note"] });

      // One control holds one claim. A push elsewhere is not that control unmounting.
      await context.execute({ type: "array.push", path: "items", value: { sku: "b", note: "B" } });
      await context.execute({ type: "unmount", paths: ["items.0.note"] });

      const after = context.observe("the control released its only claim");
      expectClaim(after.fieldNames.includes("items.0.note"), {
        claimIds: ["LIF-002"],
        what: "the row still owns its field after its control left",
        detail: after.fieldNames.join(", "),
      });
      expectClaim(after.value.of.items.length === 2, {
        claimIds: ["LIF-002"],
        what: "and both rows are still there",
        detail: JSON.stringify(after.value),
      });
    } finally {
      await context.dispose();
    }
  },
);

battle(
  {
    claims: ["COL-001"],
    title: "a structural change still rebuilds the rows it moves clean",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ items: array(group({ sku: field("") })) }, { devWarnings: false });

    try {
      for (const sku of ["a", "b", "c"]) form.f.items.push({ sku });
      form.f.items.at(0).sku.markAsTouched();
      form.f.items.at(2).sku.markAsDirty();
      ctx.log.note("marked two rows, then moved one", {});

      form.f.items.move(0, 1);

      const flags = [0, 1, 2].map((index) => [
        form.f.items.at(index).sku.touched(),
        form.f.items.at(index).sku.dirty(),
      ]);
      expectClaim(flags.every(([touched, dirty]) => !touched && !dirty), {
        claimIds: ["COL-001"],
        what: "what a structural change rebuilds, it rebuilds clean",
        detail: JSON.stringify(flags),
      });
    } finally {
      form.destroy();
    }
  },
);
