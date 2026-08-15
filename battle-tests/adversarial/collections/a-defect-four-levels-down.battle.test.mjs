/**
 * A defect at the bottom of the deepest shape the project publishes, and what moving the top does to it.
 *
 * `spec/fixtures/dynamic-form/v3/nested-collections.json` is a keyed map of orders, each holding a
 * keyed map of lines, each holding a list of allocations. The fixture puts `required` on the order's
 * customer and `min: 0` on the allocation's quantity, so it carries a rule at the top of the nesting
 * and one at the bottom.
 *
 * Renaming a row is the operation with the most to get wrong here. It is not remove-and-re-add: the
 * record contract says it carries "value, validity and `touched`", which means an error the user
 * caused four levels below the row being renamed has to arrive at a path that did not exist a moment
 * ago, and stop being reachable at the one that did. An error left at the old path is an error no
 * control can render; one duplicated at both is a field that reports twice.
 *
 * Renaming twice at two different depths is the part a single rename cannot show: an implementation
 * that rewrites one segment of a path rather than the row's identity passes the first and fails the
 * second.
 *
 * The scope of each surface is asserted alongside, because the interesting answers are easy to read
 * wrongly: a collection's `errors` carries what is attributed to the collection's own path and not
 * what its rows hold, and `validOf` is the surface that answers for a row.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const FIXTURE = resolve(HERE, "..", "..", "..", "spec", "fixtures", "dynamic-form", "v3", "nested-collections.json");

const document = () => JSON.parse(readFileSync(FIXTURE, "utf8"));

/** Message text at a path, so an assertion names what a control would show. */
const messagesAt = (form, path) => form.errorsFor(path)().map((each) => each.message);

battle(
  {
    claims: ["COL-003", "VAL-003"],
    title: "a rule at the bottom of four levels is a rule the form is held to",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm(buildDynamicFormSchema(document().schema), { devWarnings: false });
    try {
      // The control: an empty form of this shape is valid. Every verdict below is something a row
      // caused rather than a state the shape starts in.
      expectClaim(form.state.valid() && form.state.canSubmit(), {
        claimIds: ["VAL-003"],
        what: "the fixture's empty form is already invalid, so nothing below attributes to a row",
      });

      form.f.orders.upsert("A");
      ctx.log.note("one order, whose customer the fixture requires", { valid: form.state.valid() });

      expectClaim(!form.state.valid() && form.state.canSubmit() === false, {
        claimIds: ["VAL-003"],
        what: "a row with a blank required cell left the form submittable",
      });

      form.f.orders.row("A").customer.set("Ada");
      expectClaim(form.state.valid(), {
        claimIds: ["VAL-003"],
        what: "filling the required cell did not clear the verdict, so the rule below is not the one being read",
      });

      // Now the rule at the other end of the nesting, three collections down.
      form.f.orders.row("A").lines.upsert("L");
      form.f.orders.row("A").lines.row("L").allocations.push();
      const deepest = "orders.A.lines.L.allocations.0.qty";

      expectClaim(form.state.valid(), {
        claimIds: ["COL-003"],
        what: "adding empty rows made the form invalid before any rule was broken",
        detail: JSON.stringify(messagesAt(form, deepest)),
      });

      form.f.orders.row("A").lines.row("L").allocations.at(0).qty.set(-5);
      ctx.log.note("a quantity below the fixture's minimum, four levels down", {
        valid: form.state.valid(),
        at: messagesAt(form, deepest),
      });

      expectClaim(!form.state.valid() && form.state.canSubmit() === false, {
        claimIds: ["VAL-003", "COL-003"],
        what: "a value breaking a rule three collections down left the form submittable",
      });

      expectClaim(messagesAt(form, deepest).length > 0, {
        claimIds: ["COL-003"],
        what: "the form knows it is invalid and the deepest path reports nothing, so no control can say why",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-003", "COL-004"],
    title: "renaming a row twice, at two depths, carries the defect with it both times",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm(buildDynamicFormSchema(document().schema), { devWarnings: false });
    try {
      form.f.orders.upsert("A");
      form.f.orders.row("A").customer.set("Ada");
      form.f.orders.row("A").lines.upsert("L");
      form.f.orders.row("A").lines.row("L").allocations.push();
      form.f.orders.row("A").lines.row("L").allocations.at(0).qty.set(-5);

      const before = messagesAt(form, "orders.A.lines.L.allocations.0.qty");
      expectClaim(before.length > 0, {
        claimIds: ["COL-003"],
        what: "the defect was not reported before the rename, so what follows would be trivially true",
      });

      // The outer rename: the row being moved is three levels above the defect.
      form.f.orders.rename("A", "B");
      ctx.log.note("the outer row renamed", {
        old: messagesAt(form, "orders.A.lines.L.allocations.0.qty"),
        moved: messagesAt(form, "orders.B.lines.L.allocations.0.qty"),
      });

      expectEqual(messagesAt(form, "orders.B.lines.L.allocations.0.qty"), before, {
        claimIds: ["COL-004"],
        what: "renaming the order did not carry the defect in its allocation to the new path",
      });

      expectEqual(messagesAt(form, "orders.A.lines.L.allocations.0.qty"), [], {
        claimIds: ["COL-004"],
        what: "the defect is still reported at the key the row no longer has, so a control renders an error twice",
      });

      // The inner rename, which a path rewrite that happens to work at one depth does not survive.
      form.f.orders.row("B").lines.rename("L", "M");
      ctx.log.note("the inner row renamed", {
        old: messagesAt(form, "orders.B.lines.L.allocations.0.qty"),
        moved: messagesAt(form, "orders.B.lines.M.allocations.0.qty"),
      });

      expectEqual(messagesAt(form, "orders.B.lines.M.allocations.0.qty"), before, {
        claimIds: ["COL-004"],
        what: "renaming the line did not carry the defect in its allocation to the new path",
      });

      expectEqual(messagesAt(form, "orders.B.lines.L.allocations.0.qty"), [], {
        claimIds: ["COL-004"],
        what: "the defect survives at the line key that was renamed away",
      });

      // And the verdict never wavered: the value is the same one, wherever it is now addressed.
      expectClaim(!form.state.valid(), {
        claimIds: ["COL-003"],
        what: "two renames made a form holding a value that breaks a rule report as valid",
        detail: JSON.stringify(form.getValue()),
      });

      // The surfaces that answer for a row, and their scope. A collection reports what is attributed
      // to its own path; `validOf` is what answers for the row.
      expectEqual(form.f.orders.errors(), [], {
        claimIds: ["COL-003"],
        what: "the collection reported a descendant's error as its own",
      });

      expectClaim(form.f.orders.validOf("B") === false, {
        claimIds: ["COL-003"],
        what: "the row holding an invalid allocation answers that it is valid",
      });
    } finally {
      form.destroy();
    }
  },
);
