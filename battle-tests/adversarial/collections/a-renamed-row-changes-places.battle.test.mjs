/**
 * Renaming a row, and where the row ends up.
 *
 * The record contract defines `rename` against the operation it is not:
 *
 *   Moves a row to a new key, carrying value, validity and `touched`. `remove` followed by `upsert`
 *   reaches the same value; what only this can keep is the state the user produced — a field they
 *   visited stays visited.
 *
 * It keeps that. A visited field stays visited through a rename and does not through
 * remove-then-upsert, and both halves are asserted here because the finding is what happens *besides*
 * that, not instead of it.
 *
 * Besides that, the row moves to the end. `remove` + `upsert` produces the identical key order, so on
 * the one axis a person looking at a table can see, the two operations are the same operation. A user
 * who renames the second row of five watches it jump to the bottom.
 *
 * Order is not mentioned in the contract, which is what makes this a finding rather than a
 * disagreement: a consumer reading the sentence above has no way to learn it, and the case that would
 * teach them — renaming the last row — is the one where nothing appears to happen.
 *
 * Either resolution closes it: keep the row where it was, or say in the contract that a rename
 * reorders. The battle asserts the position because that is what a rendered list shows; a documented
 * move would make this battle wrong on purpose, and that is a better outcome than silence.
 *
 * Found by surveying past the first divergence a campaign meets: this class of disagreement first
 * appears around run 35, and the property it lives in stops at run 0 on a different one.
 */

import { createForm, field, group, record, required } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const orders = () => createForm({ orders: record(group({ ref: field("", [required()]) })) }, { devWarnings: false });

/** Three rows, in the order a user entered them. */
function threeRows(form) {
  for (const key of ["one", "two", "three"]) form.f.orders.upsert(key, { ref: key });
  return form;
}

battle(
  {
    claims: ["COL-004", "COL-002"],
    title: "a rename keeps what the contract says it keeps",
    environments: ["node"],
  },
  async (ctx) => {
    // The control for everything below: rename really is the operation the contract describes, so a
    // difference in the next battle is a difference *besides* the one it promises.
    const renamed = threeRows(orders());
    const rebuilt = threeRows(orders());
    try {
      renamed.f.orders.row("two").ref.markAsTouched();
      rebuilt.f.orders.row("two").ref.markAsTouched();

      renamed.f.orders.rename("two", "zzz");
      rebuilt.f.orders.remove("two");
      rebuilt.f.orders.upsert("zzz", { ref: "two" });

      ctx.log.note("what each route kept", {
        rename: { touched: renamed.f.orders.row("zzz").ref.touched(), value: renamed.f.orders.row("zzz").ref.value() },
        rebuild: { touched: rebuilt.f.orders.row("zzz").ref.touched(), value: rebuilt.f.orders.row("zzz").ref.value() },
      });

      expectClaim(renamed.f.orders.row("zzz").ref.touched() === true, {
        claimIds: ["COL-004"],
        what: "a rename lost the visit the user made, which is the one thing the contract says only it keeps",
      });

      expectClaim(rebuilt.f.orders.row("zzz").ref.touched() === false, {
        claimIds: ["COL-004"],
        what: "remove-then-upsert kept the visit, so the contract's distinction is not the one being tested",
      });

      expectEqual(renamed.f.orders.row("zzz").ref.value(), "two", {
        claimIds: ["COL-004"],
        what: "a rename did not carry the row's value to the new key",
      });
    } finally {
      renamed.destroy();
      rebuilt.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-004", "COL-002"],
    title: "a renamed row is still where the user left it",
    environments: ["node"],
  },
  async (ctx) => {
    const renamed = threeRows(orders());
    const rebuilt = threeRows(orders());
    try {
      // The premise: a keyed collection has an order, and it is the one rows were declared in.
      expectEqual(renamed.f.orders.keys(), ["one", "two", "three"], {
        claimIds: ["COL-002"],
        what: "a keyed collection does not report its rows in the order they were declared, so position is not observable",
      });

      renamed.f.orders.rename("two", "zzz");
      rebuilt.f.orders.remove("two");
      rebuilt.f.orders.upsert("zzz", { ref: "two" });

      ctx.log.note("where each route left the row", {
        rename: renamed.f.orders.keys(),
        rebuild: rebuilt.f.orders.keys(),
        value: Object.keys(renamed.getValue().orders),
      });

      // The comparison that makes this a finding rather than a preference: on the axis a table shows,
      // the two operations are indistinguishable.
      expectClaim(JSON.stringify(renamed.f.orders.keys()) !== JSON.stringify(rebuilt.f.orders.keys()), {
        claimIds: ["COL-004"],
        what: "renaming a row leaves the collection in the same order as removing it and adding it back, which is the operation the contract defines rename against",
        detail: JSON.stringify({ rename: renamed.f.orders.keys(), rebuild: rebuilt.f.orders.keys() }),
      });

      expectEqual(renamed.f.orders.keys(), ["one", "zzz", "three"], {
        claimIds: ["COL-004"],
        what: "a renamed row moved to the end of the collection, so a rendered list shows it somewhere the user did not put it",
      });

      // And the value object agrees with the handle, so this is not a reporting artefact of `keys()`.
      expectEqual(Object.keys(renamed.getValue().orders), renamed.f.orders.keys(), {
        claimIds: ["COL-002"],
        what: "the value and the handle disagree about the order of the rows",
      });
    } finally {
      renamed.destroy();
      rebuilt.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-004", "COL-003"],
    title: "the same happens to a row one level down",
    environments: ["node"],
  },
  async (ctx) => {
    // A nested collection is where a rename is most likely to be used and least likely to be noticed:
    // the list is short and the row that moves is inside another row.
    const form = createForm(
      { orders: record(group({ lines: record(group({ sku: field("") })) })) },
      { devWarnings: false },
    );
    try {
      form.f.orders.upsert("A");
      for (const key of ["x", "y", "z"]) form.f.orders.row("A").lines.upsert(key, { sku: key });

      form.f.orders.row("A").lines.rename("x", "w");
      ctx.log.note("a nested rename", { keys: form.f.orders.row("A").lines.keys() });

      expectEqual(form.f.orders.row("A").lines.keys(), ["w", "y", "z"], {
        claimIds: ["COL-004", "COL-003"],
        what: "a nested row moved to the end of its collection when it was renamed",
      });
    } finally {
      form.destroy();
    }
  },
);
