/**
 * The same row, reached two ways, and only one of them is in the patch.
 *
 * `getChanges()` is documented as a minimal nested patch — an `Object.is` diff of each leaf against
 * its initial — and the guide talks about it as what a consumer sends. A row created with its values
 * has those values *as its initials*, so there is nothing to diff and the patch is empty. A row
 * created empty and then filled has a diff, so the patch carries it.
 *
 * Both are consistent with the definition. Together they mean the patch depends on **how the row was
 * made** rather than on what it holds, and the two idioms are not a consumer's choice: one is what a
 * renderer does when it adds a row with defaults, the other is what happens when a person types into
 * a blank one.
 *
 * So a user adds a line, types a code, and saves — and whether the code reaches the server depends on
 * an implementation detail of the control they used. Typing it, then correcting it, makes it appear.
 *
 * The value itself is never lost: `getValue()` and `submitValue()` carry it in both cases, and that
 * is asserted first. This is about the patch path alone, which is the one the guide names for sending
 * a change.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

const document = {
  node: "group",
  children: {
    rows: {
      node: "record",
      item: { node: "group", children: { sku: { node: "field", field: { kind: "text", label: "S" } } } },
    },
  },
};

const SKU = "ABC-123";

/** The same row, reached by declaring it with its value or by filling it afterwards. */
async function reach(how) {
  const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
  if (how === "declared with its value") {
    form.f.rows.upsert("line-1", { sku: SKU });
  } else {
    form.f.rows.upsert("line-1", {});
    await settled();
    form.f.rows.cell("line-1", "sku").set(SKU);
  }
  await settled();

  const seen = {
    held: form.getValue(),
    submitted: form.submitValue(),
    changes: form.getChanges(),
  };
  form.destroy();
  return seen;
}

battle(
  {
    claims: ["SUB-001", "COL-002"],
    severity: "S1",
    title: "a patch says what a row holds, however the row came to hold it",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = await reach("declared with its value");
    const filled = await reach("filled afterwards");
    ctx.log.note("the same row, two ways", { declared, filled });

    // The premise: both really did end up holding the same thing, so the comparison below is about
    // reading rather than about two different forms.
    expectEqual(declared.held, filled.held, {
      claimIds: ["COL-002"],
      what: "the two routes did not reach the same value, so nothing below compares like with like",
    });

    expectEqual(declared.submitted, filled.submitted, {
      claimIds: ["SUB-001"],
      what: "the two routes submit different values, which is a larger finding than this one",
    });

    // The control: a submission carries the value, so it is not lost — only the patch path is in
    // question.
    expectClaim(JSON.stringify(declared.submitted).includes(SKU), {
      claimIds: ["SUB-001"],
      what: "a row declared with its value does not submit it, so this battle is about something else",
      detail: () => JSON.stringify(declared),
    });

    // And the patch, which is what the guide names for sending a change.
    expectEqual(declared.changes, filled.changes, {
      claimIds: ["SUB-001", "COL-002"],
      what: "the patch a form reports depends on how the row was made rather than on what it holds",
    });
  },
);
