/**
 * A field the form is not asking about.
 *
 * A schema is static and a form is not. A field that belongs to a branch the user did not take is
 * declared like every other one, and a `required()` on it makes the form permanently invalid — with
 * the offending field nowhere on screen to explain why. `when` is how the schema says the field
 * only counts under a condition.
 *
 * The whole design rests on one claim, and these tests exist to try to break it: **out of play is
 * exactly what disabled already means here.** If it differs anywhere — validity, submit, the value
 * the model holds — then it is a fourth state wearing the name of a third, and the claim is false.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { array, createForm, field, group, record, required } from "../dist/index.js";

const conditional = () =>
  createForm({
    kind: field("simple"),
    // Only asked for when the user chose the branch that needs it.
    reason: field("", [required()], { when: (_value, form) => form["kind"] === "detailed" }),
  });

test("a form is valid while the branch that needs the field is not taken", () => {
  const form = conditional();

  assert.equal(form.state.valid(), true, "nothing on screen asks for a reason");
});

test("the field keeps its own verdict, and the form ignores it — as for any disabled field", () => {
  const form = conditional();
  const disabledByBinding = createForm({ note: field("", [required()]) });
  disabledByBinding.setDisabled("note", () => true);

  // Not a quirk of `when`: a disabled field still runs its own rules, and form validity is where
  // the exclusion happens. The two must agree, or `when` is a fourth state wearing a third's name.
  assert.equal(form.f.reason.valid(), false, "the rule still has an opinion about the value");
  assert.equal(disabledByBinding.f.note.valid(), false, "and so does a field disabled by a binding");

  assert.equal(form.state.valid(), true);
  assert.equal(disabledByBinding.state.valid(), true);
});

test("the same field counts as soon as its branch is taken", () => {
  const form = conditional();

  form.f.kind.set("detailed");

  assert.equal(form.state.valid(), false, "now the reason is missing");
  form.f.reason.set("because");
  assert.equal(form.state.valid(), true);
});

test("a field out of play is not submitted, and its value is kept", () => {
  const form = conditional();

  form.f.kind.set("detailed");
  form.f.reason.set("typed while the branch was open");
  form.f.kind.set("simple");

  assert.equal(
    form.getValue()["reason"],
    "typed while the branch was open",
    "the editing model keeps what the user typed — coming back must not lose it",
  );
  assert.equal("reason" in form.submitValue(), false, "what is not asked is not sent");
});

test("out of play is the state disabled already is", () => {
  const form = conditional();

  assert.equal(form.f.reason.interactivity(), "disabled");
  assert.equal(form.f.reason.disabled(), true);

  form.f.kind.set("detailed");

  assert.equal(form.f.reason.interactivity(), "enabled");
  assert.equal(form.f.reason.disabled(), false);
});

test("a binding's own disabled and the schema's condition do not cancel each other", () => {
  const form = conditional();

  form.f.kind.set("detailed");
  form.setDisabled("reason", () => true);
  assert.equal(form.f.reason.disabled(), true, "the binding disables an active field");

  form.setDisabled("reason", () => false);
  form.f.kind.set("simple");
  assert.equal(
    form.f.reason.disabled(),
    true,
    "and re-enabling it does not put back in play a field the schema left out",
  );
});

test("the predicate reads the whole form value, not only its own field", () => {
  const form = createForm({
    country: field("IT"),
    address: group({
      state: field("", [required()], {
        when: (_value, form) => form["country"] === "US",
      }),
    }),
  });

  assert.equal(form.state.valid(), true);
  form.f.country.set("US");
  assert.equal(form.state.valid(), false, "a US address needs a state");
});

test("a field with no condition is untouched by any of this", () => {
  const form = createForm({ name: field("", [required()]) });

  assert.equal(form.f.name.interactivity(), "enabled");
  assert.equal(form.state.valid(), false, "required still means required");
});

test("the condition may read the field's own value", () => {
  const form = createForm({
    quantity: field(0, [required()], { when: (value) => value !== 0 }),
  });

  assert.equal(form.f.quantity.disabled(), true, "zero takes it out of play");
  form.f.quantity.set(5);
  assert.equal(form.f.quantity.disabled(), false);
});

/**
 * Inside a collection the enclosing value is the row.
 *
 * A rule written once for the item cannot name a key or an index — keys are data and rows move — so
 * handing it the whole form value would give it nothing it could navigate. What encloses a cell is
 * its row, and that is what the condition reads.
 */
test("a condition inside a keyed collection reads its own row", () => {
  const form = createForm({
    rows: record(group({
      kind: field("simple"),
      reason: field("", [required()], { when: (_value, row) => row.kind === "detailed" }),
    })),
  });

  form.f.rows.upsert("a", { kind: "simple", reason: "" });
  assert.equal(form.state.valid(), true, "this row is not asking for a reason");
  assert.equal(form.getField("rows.a.reason")().interactivity(), "disabled");

  form.f.rows.upsert("b", { kind: "detailed", reason: "" });
  assert.equal(form.state.valid(), false, "and this one is");

  form.f.rows.cell("b", "reason").set("because");
  assert.equal(form.state.valid(), true);
});

test("each row answers for itself", () => {
  const form = createForm({
    rows: record(group({
      kind: field("simple"),
      reason: field("", [required()], { when: (_value, row) => row.kind === "detailed" }),
    })),
  });

  form.f.rows.upsert("a", { kind: "detailed", reason: "given" });
  form.f.rows.upsert("b", { kind: "simple", reason: "" });

  assert.equal(form.getField("rows.a.reason")().disabled(), false);
  assert.equal(form.getField("rows.b.reason")().disabled(), true, "a sibling row does not decide");
  assert.equal(form.state.valid(), true);
});

test("a condition follows a row that changes its mind", () => {
  const form = createForm({
    rows: record(group({
      kind: field("simple"),
      reason: field("", [required()], { when: (_value, row) => row.kind === "detailed" }),
    })),
  });

  form.f.rows.upsert("a", { kind: "simple", reason: "" });
  form.f.rows.cell("a", "kind").set("detailed");

  assert.equal(form.state.valid(), false, "the row now asks for a reason");
  assert.equal(form.getField("rows.a.reason")().disabled(), false);
});

test("a condition inside an array reads its own row too", () => {
  const form = createForm({
    items: array(group({
      kind: field("simple"),
      reason: field("", [required()], { when: (_value, row) => row.kind === "detailed" }),
    })),
  });

  form.f.items.push({ kind: "simple", reason: "" });
  assert.equal(form.state.valid(), true);

  form.f.items.push({ kind: "detailed", reason: "" });
  assert.equal(form.state.valid(), false);

  form.f.items.rows()[1].reason.set("because");
  assert.equal(form.state.valid(), true);
});

test("a row removed while out of play takes its condition with it", () => {
  const form = createForm({
    rows: record(group({
      kind: field("simple"),
      reason: field("", [required()], { when: (_value, row) => row.kind === "detailed" }),
    })),
  });

  form.f.rows.upsert("a", { kind: "detailed", reason: "" });
  assert.equal(form.state.valid(), false);

  form.f.rows.remove("a");
  assert.equal(form.state.valid(), true, "the row is gone, and so is what it was asking for");
  assert.deepEqual(form.value().rows, {});
});
