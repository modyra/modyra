/**
 * A structural change resets the rows it moves — and only those.
 *
 * That sentence is the contract's own. What the implementation did was reset every row on every
 * structural call: adding a line at the end cleared the "you visited this" mark on every field
 * above it, and a `remove(5)` on a list of one — which removes nothing — did the same.
 *
 * A user fills three lines, sees the errors that only show once a field is touched, adds a fourth,
 * and the errors disappear. That is what this attacks.
 *
 * Found by the generated array campaign.
 */

import { array, createForm, field, group } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const threeRows = () => {
  const form = createForm({ items: array(group({ sku: field(""), note: field("") })) }, { devWarnings: false });
  for (const sku of ["a", "b", "c"]) form.f.items.push({ sku, note: "" });
  return form;
};

const marks = (form) =>
  Array.from({ length: form.f.items.length() }, (_, index) => [
    form.f.items.at(index).sku.touched(),
    form.f.items.at(index).sku.dirty(),
  ]);

battle(
  {
    claims: ["COL-001", "LIF-002"],
    title: "adding a row leaves the rows above it as the user left them",
    environments: ["node"],
  },
  async (ctx) => {
    const form = threeRows();
    try {
      form.f.items.at(0).sku.markAsTouched();
      form.f.items.at(1).sku.markAsDirty();
      ctx.log.note("marked two rows, then appended a third", {});

      form.f.items.push({ sku: "d", note: "" });

      const after = marks(form);
      expectClaim(after[0][0] === true, {
        claimIds: ["COL-001", "LIF-002"],
        what: "a row nothing moved keeps its touched mark",
        detail: JSON.stringify(after),
      });
      expectClaim(after[1][1] === true, {
        claimIds: ["COL-001", "LIF-002"],
        what: "and its dirty mark",
        detail: JSON.stringify(after),
      });
      expectClaim(after[3][0] === false && after[3][1] === false, {
        claimIds: ["COL-001"],
        what: "while the new row arrives clean",
        detail: JSON.stringify(after),
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-001"],
    title: "a removal that removes nothing changes nothing",
    environments: ["node"],
  },
  async (ctx) => {
    const form = threeRows();
    try {
      form.f.items.at(0).sku.markAsTouched();
      const before = { marks: marks(form), value: JSON.stringify(form.getValue()) };
      ctx.log.note("removing an index the list does not have", { index: 9 });

      form.f.items.remove(9);

      expectClaim(JSON.stringify(marks(form)) === JSON.stringify(before.marks), {
        claimIds: ["COL-001"],
        what: "the marks are untouched",
        detail: `${JSON.stringify(before.marks)} became ${JSON.stringify(marks(form))}`,
      });
      expectClaim(JSON.stringify(form.getValue()) === before.value, {
        claimIds: ["COL-001"],
        what: "and so is the value",
        detail: JSON.stringify(form.getValue()),
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-001"],
    title: "a change that does move rows still resets the ones it moved",
    environments: ["node"],
  },
  async (ctx) => {
    const form = threeRows();
    try {
      form.f.items.at(0).sku.markAsTouched();
      form.f.items.at(2).sku.markAsDirty();
      ctx.log.note("inserting at the front, which moves every row", {});

      form.f.items.insert(0, { sku: "z", note: "" });

      const after = marks(form);
      expectClaim(after.every(([touched, dirty]) => !touched && !dirty), {
        claimIds: ["COL-001"],
        what: "what the change rebuilds, it rebuilds clean",
        detail: JSON.stringify(after),
      });
      expectClaim(form.getValue().items.map((row) => row.sku).join(",") === "z,a,b,c", {
        claimIds: ["COL-001"],
        what: "and the rows are in their new order",
        detail: JSON.stringify(form.getValue()),
      });
    } finally {
      form.destroy();
    }
  },
);
