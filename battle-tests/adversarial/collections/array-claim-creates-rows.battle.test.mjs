/**
 * A control bound to a row of a list that does not exist yet.
 *
 * A keyed collection refuses it: the claim waits, and nothing is declared. A positional collection
 * had no gate over existence, and a claim was indistinguishable from a write at the level its
 * reconciliation reads — so binding a control to `items.1.sku` on an empty list made `getValue()`
 * throw on the hole where row 0 should be, put a row nobody declared into `submitValue()`, and grew
 * the list to two rows a tick later.
 *
 * A list now answers the same way a keyed collection does: a *claim* waits for the row, while a
 * *write* still grows the list to receive it, which is how a restored draft brings a row back.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const read = (fn) => {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, message: error.message };
  }
};

battle(
  {
    claims: ["COL-001", "SUB-001"],
    title: "binding a control to a row of a list does not create rows",
    environments: ["node"],
  },
  async (ctx) => {
    const withArray = createForm(
      { items: array(group({ sku: field(""), note: field("unset") })) },
      { devWarnings: false },
    );
    const withRecord = createForm({ rows: record(group({ sku: field("") })) }, { devWarnings: false });

    try {
      // The same act against both kinds: a control binds where no row is declared.
      withArray.claimField("items.1.sku");
      withRecord.claimField("rows.ghost.sku");
      ctx.log.note("claimed a cell of an undeclared row in both kinds", {});

      const keyedValue = read(() => withRecord.getValue());
      expectClaim(keyedValue.ok && withRecord.f.rows.keys().length === 0, {
        claimIds: ["COL-001"],
        what: "the keyed collection declares nothing and still answers",
        detail: JSON.stringify(keyedValue),
      });

      const positionalValue = read(() => withArray.getValue());
      expectClaim(positionalValue.ok, {
        claimIds: ["COL-001"],
        what: "the list still answers what it holds",
        detail: positionalValue.message ?? "",
      });

      const submitted = read(() => withArray.submitValue());
      expectClaim(JSON.stringify(submitted.value?.items ?? []) === "[]", {
        claimIds: ["SUB-001"],
        what: "no row nobody declared reaches the payload",
        detail: JSON.stringify(submitted.value),
      });

      await ctx.scheduler.flush();
      expectClaim(withArray.f.items.length() === 0, {
        claimIds: ["COL-001"],
        what: "and the list is still empty a tick later",
        detail: `length=${withArray.f.items.length()}`,
      });
    } finally {
      withArray.destroy();
      withRecord.destroy();
    }
  },
);
