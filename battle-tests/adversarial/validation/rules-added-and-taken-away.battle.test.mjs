/**
 * Rules an application turns on and off while the form is open.
 *
 * `upsertValidators(name, key, validators, marksRequired)` and `removeValidators(name, key)` are how
 * a rule arrives after the schema did — a plan that changes what is mandatory, a role that unlocks a
 * field, a wizard step that tightens a bound. The key is what makes two sources of rules on one
 * field independent, and independence is the whole point: a screen that removes its own rule and
 * takes another screen's with it is a field nobody can satisfy, with no rule left to explain why.
 *
 * `removeValidators` had no battle, and neither did `markAllTouched` — which `submit` leans on to
 * make a refusal visible — nor `cellHandle`.
 *
 * The `required` *fact* is asserted beside the verdict on purpose. It is what becomes the control's
 * native `required` attribute, so a fact that outlives the rule that declared it is a browser
 * refusing a value no validator objects to.
 */

import { createForm, minLength, required, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({ version: 2, fields: Object.freeze({ note: Object.freeze({ kind: "text" }) }) });

const COLLECTION_SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    note: Object.freeze({ kind: "text" }),
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

const open = (spec) =>
  createForm(buildSchema(spec).schema, { reactivity: vanillaReactivity(), devWarnings: false });

const messages = (form) => form.errorsFor("note")().map((each) => each.message);
const isRequired = (form) => form.getField("note")?.().required() ?? null;

battle(
  {
    claims: ["VAL-004", "VAL-002"],
    title: "taking one source of rules away leaves the others where they were",
    environments: ["node"],
  },
  async (ctx) => {
    const form = open(SPEC);

    form.upsertValidators("note", "a", [required()], true);
    form.upsertValidators("note", "b", [minLength(5)]);
    form.f.note.set("ab");
    ctx.log.note("two keyed groups on one field", { messages: messages(form), required: isRequired(form) });

    // The control: both are in force, so what follows is the removal rather than a rule that never
    // arrived.
    expectClaim(isRequired(form) === true && messages(form).length > 0, {
      claimIds: ["VAL-004"],
      what: "the rules this battle adds did not take effect",
      detail: JSON.stringify({ required: isRequired(form), messages: messages(form) }),
    });

    form.removeValidators("note", "a");
    ctx.log.note("one group removed", { messages: messages(form), required: isRequired(form) });

    // The other source is untouched: its verdict still stands.
    expectClaim(messages(form).some((each) => /length/i.test(each)), {
      claimIds: ["VAL-004"],
      what: "removing one source of rules took another source's rule with it",
      detail: JSON.stringify(messages(form)),
    });

    // And the fact goes with the rule that declared it, or a control keeps a native `required` no
    // validator is enforcing.
    expectEqual(isRequired(form), false, {
      claimIds: ["VAL-004", "VAL-002"],
      what: "a field stayed required after the rule that made it required was removed",
    });

    form.removeValidators("note", "b");
    expectEqual([messages(form), form.state.valid()], [[], true], {
      claimIds: ["VAL-004"],
      what: "a field kept a verdict after every rule was removed",
    });

    // Removing what is not there is what a teardown does when it does not track what it added.
    form.removeValidators("note", "a");
    form.removeValidators("note", "never-added");
    expectEqual([messages(form), form.state.valid()], [[], true], {
      claimIds: ["VAL-004"],
      what: "removing a key twice, or one that was never added, changed the form",
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["VAL-003", "COL-001"],
    title: "marking everything touched marks what is there, and does not follow what arrives after",
    environments: ["node"],
  },
  async (ctx) => {
    const form = open(COLLECTION_SPEC);
    form.f.rows.upsert("a", { code: "A" });

    const touched = () => form.fieldNames().filter((name) => form.getField(name)?.().touched()).sort();
    expectEqual(touched(), [], {
      claimIds: ["VAL-003"],
      what: "a form marked something touched before anyone asked",
    });

    // What `submit` leans on to make a refusal visible: an untouched field shows no error.
    form.markAllTouched();
    const marked = touched();
    ctx.log.note("everything touched", { marked });

    expectClaim(marked.includes("note") && marked.includes("rows.a.code"), {
      claimIds: ["VAL-003", "COL-001"],
      what: "marking everything touched missed a field, or a cell inside a row",
      detail: JSON.stringify(marked),
    });

    // A row declared afterwards is a field the user has not reached. Marking it would show errors
    // for something nobody has been given the chance to fill in.
    form.f.rows.upsert("b", { code: "B" });
    ctx.log.note("a row declared after the marking", { marked: touched() });

    expectClaim(!touched().includes("rows.b.code"), {
      claimIds: ["VAL-003"],
      what: "a row declared after the marking arrived already touched",
      detail: JSON.stringify(touched()),
    });

    // And the handle a control is given for a cell exists for a path that names one.
    expectClaim(typeof form.cellHandle("rows.a.code") === "object" && form.cellHandle("rows.a.code") !== null, {
      claimIds: ["COL-001"],
      what: "no handle was given for a cell that exists",
    });

    form.destroy();
  },
);
