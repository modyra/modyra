/**
 * The kind's own guard, attached by both of the calls a consumer is told to make.
 *
 * A flat document is built in two steps, and the split is the contract: `buildFlatFormSchema`
 * declares **what the kind is** — the empty value, the shape, the offered values, and the guard that
 * refuses a value of another shape — and `applyFlatValidators` applies **what the document says**.
 * Both are published, and the second is documented on the first: *"the document's own validators come
 * from `applyFlatValidators`"*.
 *
 * The shape guard is in both. `leafFor` attaches `valueShape(kind)`, and
 * `buildDynamicFieldValidators` produces it again from the field's kind, so a consumer who makes both
 * calls gets the same rule twice and the same message twice:
 *
 *     buildFlatFormSchema only                     1  ["This field holds number"]
 *     buildFlatFormSchema + applyFlatValidators    2  ["This field holds number",
 *                                                      "This field holds number"]
 *
 * It reaches a page. Driving the same field list through the Plain host and the Lit host and asking
 * each what it holds, whether it is valid and how many errors it carries, the two disagree on **every
 * kind with a shape** — twelve of twelve — and always by exactly this: two errors against one.
 *
 * A duplicate is not a wrong verdict. The field is invalid either way and the form refuses the submit
 * either way. What it costs is what a person reads: the same sentence printed under the field twice,
 * and an error list a consumer counts to decide how much to show.
 *
 * Green when a value the kind cannot hold produces one message however the form was assembled.
 */

import { applyFlatValidators, buildFlatFormSchema, createForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

/** A one-field document of `kind`, and a value that kind's contract refuses. */
const REFUSED = Object.freeze({
  number: "seven",
  slider: "seven",
  checkbox: "yes",
  toggle: "yes",
  datepicker: "not a date",
  timepicker: "not a time",
  text: 42,
  email: 42,
});

async function messagesFor(kind, value, { applyRules }) {
  const parsed = parseDynamicForm(
    { version: 2, fields: [{ name: "v", kind, label: "V" }], layout: [] },
    { mode: "lenient" },
  );
  const form = createForm(buildFlatFormSchema(parsed.fields, parsed.collections), { devWarnings: false });
  if (applyRules) applyFlatValidators(form, parsed.fields);
  await settled();
  form.setValue({ v: value });
  form.markAllTouched();
  await settled();
  const messages = form.getField("v")().errors().map((each) => each.message);
  form.destroy();
  return messages;
}

battle(
  {
    claims: ["API-001"],
    title: "a value a kind cannot hold is refused once, not once per call",
    environments: ["node"],
  },
  async (ctx) => {
    const doubled = [];
    let checked = 0;

    for (const [kind, value] of Object.entries(REFUSED)) {
      const alone = await messagesFor(kind, value, { applyRules: false });
      const both = await messagesFor(kind, value, { applyRules: true });
      ctx.log.note("one kind, one call and then two", { kind, alone, both });

      // The control per kind: the guard fires at all. A kind whose contract took the value would
      // report nothing from either call and would agree for the wrong reason.
      if (alone.length === 0) continue;
      checked += 1;

      if (new Set(both).size !== both.length) doubled.push(`${kind}: ${JSON.stringify(both)}`);
    }

    expectClaim(checked >= 6, {
      claimIds: ["API-001"],
      what: "almost no kind refused its probe value, so this battle compared nothing",
      detail: `${checked} kind(s) of ${Object.keys(REFUSED).length}`,
    });

    expectEqual(doubled, [], {
      claimIds: ["API-001"],
      what: "the two published calls each attached the kind's guard, so its message is reported twice",
    });
  },
);
