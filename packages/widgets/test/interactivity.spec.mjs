/**
 * A read-only control can still be reached.
 *
 * `disabled` and `readonly` were two independent booleans and **fourteen** call sites each wrote
 * their own combination of them. Most wrote `disabled || readonly`, which is right for a write and
 * wrong for everything else. One site used it to apply a **native `disabled`** to the multiselect's
 * search box, which takes the control out of the tab order — removing the one capability read-only
 * exists to preserve.
 *
 * The union made that combination unrepresentable. It did not, on its own, make it *asserted*: with
 * `blocksFocus` mutated to `interactivity !== "enabled"`, every suite in the repo still passed. A
 * distinction nothing checks is a convention, and conventions are what the fourteen sites were.
 * These are the checks that fail when the two questions are confused.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required } from "@modyra/core";
import {
  blocksFocus,
  blocksValueChange,
  MDY_WIDGET_STATE_CONTRACTS,
  projectMultiselectFieldA11y,
} from "../dist/index.js";

test("the two questions differ on exactly one state", () => {
  // Enabled permits everything.
  assert.equal(blocksValueChange("enabled"), false);
  assert.equal(blocksFocus("enabled"), false);

  // Disabled permits nothing.
  assert.equal(blocksValueChange("disabled"), true);
  assert.equal(blocksFocus("disabled"), true);

  // Read-only is the whole point: it blocks the write and NOT the reach. If these two ever agree,
  // read-only has collapsed back into disabled and the fix has been undone.
  assert.equal(blocksValueChange("readonly"), true, "read-only must block a write");
  assert.equal(blocksFocus("readonly"), false, "read-only must NOT block focus");
});

const baseState = {
  value: [],
  selectedKeys: new Set(),
  counts: new Map(),
  invalid: false,
  required: false,
  touched: false,
  dirty: false,
  pending: false,
  open: false,
  query: "",
};

const project = (interactivity) =>
  projectMultiselectFieldA11y(
    {
      ...baseState,
      interactivity,
      disabled: interactivity === "disabled",
      readonly: interactivity === "readonly",
    },
    [],
    { widgetId: "tags" },
  );

test("a read-only multiselect keeps its search box reachable", () => {
  // The regression this file exists for. The search box does not change the value — it filters what
  // is shown, which a user who may read the field must still be able to do.
  const readonly = project("readonly");
  assert.equal(
    readonly.search.attributes.disabled,
    false,
    "a read-only multiselect must not disable its own search box",
  );

  const disabled = project("disabled");
  assert.equal(disabled.search.attributes.disabled, true);

  const enabled = project("enabled");
  assert.equal(enabled.search.attributes.disabled, false);
});

test("a read-only multiselect still refuses to be written, and says so correctly", () => {
  const readonly = project("readonly");

  // The trigger's native attribute is about reach, so read-only leaves it alone...
  assert.equal(readonly.trigger.attributes.disabled, false);
  // ...and the ARIA says disabled only when it is, which is what `a3c662e` fixed and what this
  // must not quietly undo.
  assert.equal(readonly.trigger.attributes["aria-disabled"], "false");
  assert.equal(project("disabled").trigger.attributes["aria-disabled"], "true");
});

/**
 * The declared behaviour is checked against the engine that implements it.
 *
 * `MDY_WIDGET_STATE_CONTRACTS` now says what `disabled` and `readonly` mean for the *form* —
 * submitted, validated, reachable — and not only what they mean for the DOM. A declaration nothing
 * compares against is a comment with a type on it, and the whole reason this batch exists is that
 * Modyra rendered the difference between these two states for months while behaving identically.
 *
 * So the contract is the source of truth here and the engine is the thing under test. If someone
 * changes either, this fails.
 */
test("the declared behaviour of disabled and readonly is what the engine does", () => {
  for (const state of ["disabled", "readonly"]) {
    const declared = MDY_WIDGET_STATE_CONTRACTS[state].behaviour;
    assert.ok(declared, `${state} must declare its behaviour`);

    const form = createForm({ subject: field("", [required()]) });
    if (state === "disabled") form.setDisabled("subject", () => true);
    else form.setReadonly("subject", () => true);

    assert.equal(
      "subject" in form.submitValue(),
      declared.submitted,
      `${state}: contract says submitted=${declared.submitted}`,
    );
    // A required empty field is invalid, so the form is valid only if this field went unvalidated.
    assert.equal(
      form.state.valid(),
      !declared.validated,
      `${state}: contract says validated=${declared.validated}`,
    );
    // Reachability is the DOM half, and `blocksFocus` is what every renderer asks.
    assert.equal(
      blocksFocus(form.getField("subject")().interactivity()),
      !declared.reachable,
      `${state}: contract says reachable=${declared.reachable}`,
    );
  }
});
