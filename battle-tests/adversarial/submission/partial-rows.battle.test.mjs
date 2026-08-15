/**
 * A row is allowed to be partial on the way out.
 *
 * `submitValue()` omits disabled fields — that is its whole difference from `getValue()`. A table
 * with a disabled column therefore produces rows that carry some of their cells and not others, and
 * `getChanges()` produces exactly the same shape for a different reason: only the leaves that moved.
 *
 * A keyed collection answers both calls with a partial row. A positional one threw, so a list with
 * one disabled cell could not state what it would send at all.
 */

import { array, createForm, field, group, record, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const attempt = (read) => {
  try {
    return { ok: true, value: read() };
  } catch (error) {
    return { ok: false, message: error.message };
  }
};

battle(
  {
    claims: ["SUB-001", "VAL-002"],
    title: "a disabled cell in a list still lets the form say what it would send",
    environments: ["node"],
  },
  async (ctx) => {
    const rx = vanillaReactivity();
    const form = createForm(
      { items: array(group({ sku: field(""), note: field("unset") })) },
      { reactivity: rx, devWarnings: false },
    );

    try {
      form.f.items.push({ sku: "a", note: "A" });
      form.f.items.push({ sku: "b", note: "B" });
      ctx.log.note("disabling one cell of one row", { path: "items.0.note" });
      form.setDisabled("items.0.note", rx.signal(true));

      const submitted = attempt(() => form.submitValue());
      expectClaim(submitted.ok, {
        claimIds: ["SUB-001", "VAL-002"],
        what: "submitValue answers when a row carries a disabled cell",
        detail: submitted.message ?? "",
      });
      expectClaim(submitted.value?.items?.[0]?.note === undefined, {
        claimIds: ["VAL-002"],
        what: "the disabled cell is not in the payload",
        detail: JSON.stringify(submitted.value),
      });
      expectClaim(submitted.value?.items?.[0]?.sku === "a", {
        claimIds: ["SUB-001"],
        what: "the rest of the row is",
        detail: JSON.stringify(submitted.value),
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["SUB-001"],
    title: "getChanges answers for a list whose row changed in one cell",
    environments: ["node"],
  },
  async (ctx) => {
    // A second field nobody touches, which is what makes "it did not answer with everything" a
    // measurement rather than a guess about the list's internal shape.
    const form = createForm(
      { items: array(group({ sku: field(""), note: field("unset") })), untouched: field("still here") },
      { devWarnings: false },
    );

    try {
      form.f.items.setAll([{ sku: "a", note: "A" }, { sku: "b", note: "B" }]);
      form.f.items.at(0).sku.set("changed");
      ctx.log.note("one cell of one row edited", { path: "items.0.sku" });

      const changes = attempt(() => form.getChanges());
      expectClaim(changes.ok, {
        claimIds: ["SUB-001"],
        what: "getChanges answers when only part of a row moved",
        detail: changes.message ?? "",
      });

      // What it answered, not merely that it answered. A getChanges that returns an empty object,
      // or the whole form, satisfies "it did not throw" while telling a consumer the wrong thing
      // about what moved.
      const moved = JSON.stringify(changes.value ?? null);
      expectClaim(moved.includes("changed"), {
        claimIds: ["SUB-001"],
        what: "the edited cell is among the changes",
        detail: moved,
      });

      // What this guards is stated in the comment above: an answer that carries the whole *form*
      // satisfies "it did not throw" and tells a consumer nothing.
      //
      // It used to guard that by looking for a value from a row nobody edited, which was a proxy —
      // and the wrong one, because whether a positional collection's change set carries its
      // untouched rows is the collection's own shape to decide, not this battle's. `MdyFormPatch`
      // declares an array as whole-item, so carrying them is one of the shapes the type allows.
      //
      // What is measured instead is the thing the comment names: a field of the form that nobody
      // touched is not in the answer.
      expectClaim(!Object.hasOwn(changes.value ?? {}, "untouched"), {
        claimIds: ["SUB-001"],
        what: "a field nobody edited is not reported as a change",
        detail: moved,
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["SUB-001", "VAL-002"],
    title: "both collection kinds answer the same way with a disabled cell",
    environments: ["node"],
  },
  async (ctx) => {
    const rx = vanillaReactivity();
    const keyed = createForm({ rows: record(group({ sku: field(""), note: field("") })) }, { reactivity: rx, devWarnings: false });
    const positional = createForm({ items: array(group({ sku: field(""), note: field("") })) }, { reactivity: rx, devWarnings: false });

    try {
      keyed.f.rows.upsert("a", { sku: "a", note: "A" });
      positional.f.items.push({ sku: "a", note: "A" });
      ctx.log.note("one disabled cell in each kind", {});

      keyed.setDisabled("rows.a.note", rx.signal(true));
      positional.setDisabled("items.0.note", rx.signal(true));

      const fromKeyed = attempt(() => keyed.submitValue());
      const fromPositional = attempt(() => positional.submitValue());

      // "Both refuse" is agreement too, and it is a broken form in both kinds. Each has to answer,
      // and the answers are then compared as answers rather than as outcomes: the battle's title
      // promises the two kinds treat a disabled cell alike, which nothing here checked.
      expectClaim(fromKeyed.ok, {
        claimIds: ["SUB-001"],
        what: "a record answers submitValue with a disabled cell in a row",
        detail: fromKeyed.message ?? "",
      });

      expectClaim(fromPositional.ok, {
        claimIds: ["SUB-001"],
        what: "an array answers submitValue with a disabled cell in a row",
        detail: fromPositional.message ?? "",
      });

      const keyedRow = fromKeyed.value?.rows?.a ?? null;
      const positionalRow = fromPositional.value?.items?.[0] ?? null;

      expectClaim(keyedRow !== null && !("note" in keyedRow), {
        claimIds: ["VAL-002"],
        what: "a record excludes the disabled cell from the submitted row",
        detail: JSON.stringify(keyedRow),
      });

      expectClaim(positionalRow !== null && !("note" in positionalRow), {
        claimIds: ["VAL-002"],
        what: "an array excludes the disabled cell from the submitted row",
        detail: JSON.stringify(positionalRow),
      });

      expectEqual(positionalRow, keyedRow, {
        claimIds: ["SUB-001", "VAL-002"],
        what: "a record and an array submit the same row for the same disabled cell",
      });
    } finally {
      keyed.destroy();
      positional.destroy();
    }
  },
);
