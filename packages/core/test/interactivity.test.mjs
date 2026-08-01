/**
 * `disabled` and `readonly` are different things.
 *
 * They were the same thing in everything but name. Both blocked interaction identically, both were
 * kept in the submitted value, both were validated — while the standards say a disabled control is
 * neither submitted nor validated and a read-only one is both. Three adapters had already been
 * taught to render the ARIA difference before the behaviour existed to back it up.
 *
 * The state is now one value rather than two booleans, so `disabled && readonly` cannot be
 * represented and the fourteen call sites that each invented their own combination have one thing
 * to ask.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required, vanillaReactivity } from "../dist/index.js";

const build = () =>
  createForm({
    kept: field("a"),
    frozen: field("b"),
    off: field("c"),
  });

/** Marks `off` disabled and `frozen` read-only. */
function arranged() {
  const form = build();
  form.setDisabled("off", () => true);
  form.setReadonly("frozen", () => true);
  return form;
}

test("interactivity is one value, and disabled and readonly derive from it", () => {
  const form = arranged();

  assert.equal(form.f.kept.path && form.getField("kept")().interactivity(), "enabled");
  assert.equal(form.getField("frozen")().interactivity(), "readonly");
  assert.equal(form.getField("off")().interactivity(), "disabled");

  // The booleans are derived, so they can never both be true.
  for (const name of ["kept", "frozen", "off"]) {
    const state = form.getField(name)();
    assert.equal(state.disabled(), state.interactivity() === "disabled", name);
    assert.equal(state.readonly(), state.interactivity() === "readonly", name);
    assert.ok(!(state.disabled() && state.readonly()), `${name} cannot be both`);
  }
});

test("disabled wins when a form sets both", () => {
  // Two bindings feed one state. `disabled` permits strictly less, and a question the form is not
  // asking cannot also be one it is asserting an answer for.
  const form = build();
  form.setReadonly("kept", () => true);
  form.setDisabled("kept", () => true);
  assert.equal(form.getField("kept")().interactivity(), "disabled");
  assert.equal(form.getField("kept")().readonly(), false);
});

test("a disabled field is not submitted; a read-only one is", async () => {
  const form = arranged();

  // The live editing model keeps everything — drafts, history and cross-field rules read it.
  assert.deepEqual(form.getValue(), { kept: "a", frozen: "b", off: "c" });

  // What leaves the browser does not.
  assert.deepEqual(form.submitValue(), { kept: "a", frozen: "b" });

  let submitted;
  await form.submit((value) => { submitted = value; });
  assert.deepEqual(submitted, { kept: "a", frozen: "b" });
  assert.ok(!("off" in submitted), "a disabled field is absent, not undefined-valued");
});

test("a disabled field is not validated; a read-only one is", () => {
  const form = createForm({
    open: field("ok", [required()]),
    frozen: field("", [required()]),
  });

  // A read-only field is still asserted: the form is standing behind its value.
  form.setReadonly("frozen", () => true);
  assert.equal(form.state.valid(), false, "read-only stays validated");

  // A disabled one is not asked at all. This *unblocks* a form that was previously stuck: the user
  // could not have fixed the error, because they could not type into the field either.
  form.setDisabled("frozen", () => true);
  assert.equal(form.state.valid(), true, "disabled stops blocking");
});

test("re-enabling a field brings its value and its validation back", () => {
  // The value was never discarded — only withheld from the payload. Anything else would lose the
  // user's work every time a field was disabled and enabled again.
  //
  // A real signal, not a mutable object: `setDisabled` takes a signal because the whole point is
  // that interactivity is reactive, and a plain closure over a field nothing tracks would never
  // re-evaluate.
  const disabled = vanillaReactivity().signal(true);
  const form = createForm({ maybe: field("", [required()]) });
  form.setDisabled("maybe", disabled);

  assert.equal(form.state.valid(), true);
  assert.deepEqual(form.submitValue(), {});

  disabled.set(false);
  assert.equal(form.state.valid(), false, "validated again");
  assert.deepEqual(form.submitValue(), { maybe: "" }, "and submitted again");
});
