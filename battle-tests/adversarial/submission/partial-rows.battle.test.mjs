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
import { expectClaim } from "../../harness/assertions.mjs";

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
    const form = createForm(
      { items: array(group({ sku: field(""), note: field("unset") })) },
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

      expectClaim(fromKeyed.ok === fromPositional.ok, {
        claimIds: ["SUB-001"],
        what: "a record and an array both answer, or both refuse",
        detail: `record=${fromKeyed.ok ? "answered" : fromKeyed.message}, array=${fromPositional.ok ? "answered" : fromPositional.message}`,
      });
    } finally {
      keyed.destroy();
      positional.destroy();
    }
  },
);
