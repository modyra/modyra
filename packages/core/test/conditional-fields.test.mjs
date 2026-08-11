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

/**
 * A whole section that is not in play.
 *
 * Repeating one predicate on every leaf of a branch is the work `when` exists to remove, so the
 * question is asked once for the section — and a field's own condition still has its say.
 */
test("a section out of play takes every field under it with it", () => {
  const form = createForm({
    kind: field("private"),
    company: group(
      { name: field("", [required()]), vat: field("", [required()]) },
      { when: (_section, form) => form.kind === "company" },
    ),
  });

  assert.equal(form.state.valid(), true, "nothing under a closed section is being asked for");
  assert.equal(form.getField("company.name")().disabled(), true);
  assert.equal("company" in form.submitValue(), false);

  form.f.kind.set("company");
  assert.equal(form.state.valid(), false, "now both fields are");
  assert.equal(form.getField("company.name")().disabled(), false);
});

test("what was typed in a section survives leaving it and coming back", () => {
  const form = createForm({
    kind: field("company"),
    company: group({ name: field("") }, { when: (_section, form) => form.kind === "company" }),
  });

  form.f.company.name.set("ACME");
  form.f.kind.set("private");

  assert.equal(form.getValue().company.name, "ACME", "the editing model keeps it");
  assert.equal("company" in form.submitValue(), false, "and a submit does not carry it");

  form.f.kind.set("company");
  assert.deepEqual(form.submitValue().company, { name: "ACME" }, "coming back finds it where it was");
});

test("a field's condition and its section's are both consulted", () => {
  const form = createForm({
    kind: field("company"),
    wantsInvoice: field(false),
    company: group(
      {
        name: field(""),
        invoiceEmail: field("", [required()], { when: (_value, form) => form.wantsInvoice === true }),
      },
      { when: (_section, form) => form.kind === "company" },
    ),
  });

  const emailDisabled = () => form.getField("company.invoiceEmail")().disabled();

  assert.equal(emailDisabled(), true, "the section is open, the field's own condition is not met");

  form.f.wantsInvoice.set(true);
  assert.equal(emailDisabled(), false, "both agree");

  form.f.kind.set("private");
  assert.equal(emailDisabled(), true, "the section closes over a field whose own condition holds");

  form.f.wantsInvoice.set(false);
  form.f.kind.set("company");
  assert.equal(emailDisabled(), true, "and the section alone is not enough either");
});

test("a section inside a section is out of play when either is", () => {
  const form = createForm({
    a: field(true),
    b: field(true),
    outer: group(
      {
        inner: group({ leaf: field("", [required()]) }, { when: (_s, form) => form.b === true }),
      },
      { when: (_s, form) => form.a === true },
    ),
  });

  const leafDisabled = () => form.getField("outer.inner.leaf")().disabled();

  assert.equal(leafDisabled(), false, "both open");
  form.f.b.set(false);
  assert.equal(leafDisabled(), true, "the inner one closed");
  form.f.b.set(true);
  form.f.a.set(false);
  assert.equal(leafDisabled(), true, "the outer one closed");
  form.f.a.set(true);
  assert.equal(leafDisabled(), false, "and it takes both to be in play again");
});

test("the section predicate reads its own value", () => {
  const form = createForm({
    address: group(
      { country: field("IT"), state: field("", [required()]) },
      // A section can decide from what it holds itself, without going up to the form.
      { when: (section) => section.country === "US" },
    ),
  });

  assert.equal(form.state.valid(), true);
  form.f.address.country.set("US");
  assert.equal(form.state.valid(), false, "a US address needs a state");
});

test("a predicate reads the form in the shape the schema declares", () => {
  const form = createForm({
    address: group({ country: field("IT") }),
    shipping: group({
      // A nested sibling, reached the way the schema spells it — not through a flat path.
      note: field("", [required()], { when: (_value, form) => form.address.country === "US" }),
    }),
  });

  assert.equal(form.state.valid(), true);
  form.f.address.country.set("US");
  assert.equal(form.state.valid(), false);
});

test("a section inside a collection row answers for that row", () => {
  const form = createForm({
    rows: record(
      group({
        kind: field("simple"),
        detail: group(
          { reason: field("", [required()]) },
          { when: (_section, row) => row.kind === "detailed" },
        ),
      }),
    ),
  });

  form.f.rows.upsert("a", { kind: "simple", detail: { reason: "" } });
  assert.equal(form.state.valid(), true, "this row's section is closed");

  form.f.rows.upsert("b", { kind: "detailed", detail: { reason: "" } });
  assert.equal(form.state.valid(), false, "and this row's is open");
  assert.equal(form.getField("rows.a.detail.reason")().disabled(), true);
  assert.equal(form.getField("rows.b.detail.reason")().disabled(), false);

  form.f.rows.cell("b", "detail.reason").set("because");
  assert.equal(form.state.valid(), true);
});

/**
 * A collection inside a section that is not in play.
 *
 * The case that says whether the composition is real: rows **already declared** must go out of play
 * with the section, not merely the ones added afterwards. A manager knows its own path and nothing
 * above it, so the sections it sits under are handed to it — rather than a fourth copy of the rule.
 */
test("a collection inside a closed section is out of play, rows and all", () => {
  const form = createForm({
    kind: field("private"),
    company: group(
      { people: record(group({ name: field("", [required()]) })) },
      { when: (_section, form) => form.kind === "company" },
    ),
  });

  form.f.company.people.upsert("a", { name: "" });
  assert.equal(form.state.valid(), true, "a row declared while the section is closed asks nothing");
  assert.equal(form.getField("company.people.a.name")().disabled(), true);

  form.f.kind.set("company");
  assert.equal(form.state.valid(), false, "opening the section brings its rows into play");
  assert.equal(form.getField("company.people.a.name")().disabled(), false);

  form.f.company.people.upsert("b", { name: "" });
  form.f.kind.set("private");
  assert.equal(form.getField("company.people.a.name")().disabled(), true, "the row that was there");
  assert.equal(form.getField("company.people.b.name")().disabled(), true, "and the one added since");
  assert.equal(form.state.valid(), true);
});

test("an array inside a closed section behaves the same way", () => {
  const form = createForm({
    kind: field("private"),
    company: group(
      { lines: array(group({ label: field("", [required()]) })) },
      { when: (_section, form) => form.kind === "company" },
    ),
  });

  form.f.company.lines.push({ label: "" });
  assert.equal(form.state.valid(), true);

  form.f.kind.set("company");
  assert.equal(form.state.valid(), false);
});

test("a whole collection that only counts sometimes is a section around it", () => {
  // Deliberately not a `when` on `record()` itself: a second way to say the same thing is surface,
  // not composition. Wrapping it in a section already reads as what it is.
  const form = createForm({
    wantsTable: field(false),
    table: group(
      // `required()` accepts zero — a price of 0 is a price — so the row is asked for something
      // that can actually be missing.
      { rows: record(group({ label: field("", [required()]) })) },
      { when: (_section, form) => form.wantsTable === true },
    ),
  });

  form.f.table.rows.upsert("a", { label: "" });
  assert.equal(form.state.valid(), true);
  form.f.wantsTable.set(true);
  assert.equal(form.state.valid(), false, "now the table's rows are being asked for");
});

/**
 * A value arriving from outside, which is how a draft comes back.
 *
 * `enableDraft` restores through `patchValue`, so a condition that only ever saw values typed into
 * it would be a condition that wakes up wrong the first time a form is resumed.
 */
test("a condition follows a value that arrives through patchValue", () => {
  const form = createForm({
    kind: field("private"),
    company: group(
      { vat: field("", [required()]) },
      { when: (_section, form) => form.kind === "company" },
    ),
  });

  assert.equal(form.state.valid(), true);

  // Exactly what a restored draft does: the whole shape at once, nothing typed.
  form.patchValue({ kind: "company", company: { vat: "" } });

  assert.equal(form.getField("company.vat")().disabled(), false, "the section opened on its own");
  assert.equal(form.state.valid(), false, "and what it holds is being asked for");

  form.patchValue({ company: { vat: "IT123" } });
  assert.equal(form.state.valid(), true);
});

test("a whole-value replacement moves a condition too", () => {
  const form = createForm({
    kind: field("company"),
    company: group({ vat: field("", [required()]) }, { when: (_s, form) => form.kind === "company" }),
  });

  form.setValue({ kind: "private", company: { vat: "" } });

  assert.equal(form.getField("company.vat")().disabled(), true);
  assert.equal(form.state.valid(), true);
});
