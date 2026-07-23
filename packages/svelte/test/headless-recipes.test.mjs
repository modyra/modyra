/**
 * Headless recipes for React-family component libraries (shadcn/ui, Radix,
 * MUI…) — identical to the React/Preact/Solid adapters' copy since the
 * recipe functions only touch the framework-agnostic field handle, never
 * a framework-specific API. Modyra's own Svelte components would bind the
 * same handle through `toStore()` instead, but the recipes below (aimed at
 * React-family component libraries) are still valid Svelte-side proof that
 * nothing about them is React-specific. See `docs/guides/headless-recipes.md`.
 *
 * The three contracts:
 * - text input (shadcn <Input>/<Textarea>, native elements): value/onChange/onBlur;
 * - checked (Radix Checkbox/Switch): checked/onCheckedChange;
 * - value (Radix Select/RadioGroup): value/onValueChange.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createForm,
  field,
  minLength,
  required,
  vanillaReactivity,
} from "../dist/index.js";

// ─── Recipe code (mirrored in docs/guides/headless-recipes.md) ───────────────

/** shadcn <Input>/<Textarea> and native elements. Call during render. */
function mdyInputProps(handle) {
  return {
    value: handle.value() ?? "",
    onChange: (e) => handle.set(e.target.value),
    onBlur: () => handle.markAsTouched(),
    disabled: handle.disabled(),
    // Invalid styling/AT only after touch — never yell at pristine fields.
    "aria-invalid": (handle.touched() && !handle.valid()) || undefined,
    "aria-required": handle.required() || undefined,
  };
}

/** Numeric variant: empty input maps to Modyra's null sentinel. */
function mdyNumberInputProps(handle) {
  const props = mdyInputProps(handle);
  return {
    ...props,
    onChange: (e) => {
      const n = e.target.valueAsNumber;
      handle.set(Number.isNaN(n) ? null : n);
    },
  };
}

/** Radix Checkbox/Switch: `checked` may be true | false | "indeterminate". */
function mdyCheckedProps(handle) {
  return {
    checked: handle.value() === true,
    onCheckedChange: (checked) => handle.set(checked === true),
    disabled: handle.disabled(),
    "aria-invalid": (handle.touched() && !handle.valid()) || undefined,
  };
}

/** Radix Select/RadioGroup: values are strings, empty means "no choice". */
function mdyValueProps(handle) {
  return {
    value: handle.value() == null ? "" : String(handle.value()),
    onValueChange: (value) => handle.set(value),
    disabled: handle.disabled(),
  };
}

/**
 * Checkbox groups (Radix checkbox per option, shadcn ToggleGroup): the
 * field holds an array of selected option values.
 */
function mdyMultiCheckedProps(handle, option) {
  const selected = () => (Array.isArray(handle.value()) ? handle.value() : []);
  return {
    checked: selected().includes(option),
    onCheckedChange: (checked) => {
      const current = selected();
      handle.set(
        checked === true
          ? [...current, option]
          : current.filter((v) => v !== option),
      );
    },
    disabled: handle.disabled(),
  };
}

/** Errors render only after touch; submit calls form.markAllTouched(). */
function mdyTouchedErrors(handle) {
  return handle.touched() ? handle.errors() : [];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("text input recipe: typing sets the value, blur touches, a11y follows state", () => {
  const form = createForm({ email: field("", [required()]) });
  const input = form.f.email;

  let props = mdyInputProps(input);
  assert.equal(props.value, "");
  assert.equal(props["aria-required"], true);
  assert.equal(props["aria-invalid"], undefined); // pristine: no yelling
  assert.equal(props.disabled, false);
  assert.deepEqual(mdyTouchedErrors(input), []);

  props.onChange({ target: { value: "a@b.co" } });
  assert.equal(input.value(), "a@b.co");

  props = mdyInputProps(input);
  props.onBlur();
  assert.equal(input.touched(), true);
  assert.deepEqual(mdyTouchedErrors(input), []); // valid: no errors

  input.set("");
  props = mdyInputProps(input);
  assert.equal(props["aria-invalid"], true); // touched + invalid
  assert.deepEqual(
    mdyTouchedErrors(input).map((e) => e.message),
    ["This field is required"],
  );
});

test("number input recipe: valueAsNumber in, null sentinel for empty", () => {
  const form = createForm({ age: field(null, []) });
  const props = mdyNumberInputProps(form.f.age);
  assert.equal(props.value, ""); // null renders as empty string

  props.onChange({ target: { value: "42", valueAsNumber: 42 } });
  assert.equal(form.f.age.value(), 42);

  mdyNumberInputProps(form.f.age).onChange({
    target: { value: "", valueAsNumber: Number.NaN },
  });
  assert.equal(form.f.age.value(), null);
});

test("checked recipe: null is unchecked, indeterminate maps to false", () => {
  const form = createForm({ terms: field(null, [required()]) });
  let props = mdyCheckedProps(form.f.terms);
  assert.equal(props.checked, false);

  props.onCheckedChange(true);
  assert.equal(form.f.terms.value(), true);

  mdyCheckedProps(form.f.terms).onCheckedChange("indeterminate");
  assert.equal(form.f.terms.value(), false);
});

test("value recipe: null maps to empty string, selection sets the raw value", () => {
  const form = createForm({ plan: field(null, []) });
  let props = mdyValueProps(form.f.plan);
  assert.equal(props.value, "");

  props.onValueChange("pro");
  assert.equal(form.f.plan.value(), "pro");
  assert.equal(mdyValueProps(form.f.plan).value, "pro");
});

test("multi-checked recipe: toggles options in an array field", () => {
  const form = createForm({ toppings: field([], [minLength(1)]) });
  const handle = form.f.toppings;

  mdyMultiCheckedProps(handle, "mushrooms").onCheckedChange(true);
  mdyMultiCheckedProps(handle, "olives").onCheckedChange(true);
  assert.deepEqual(handle.value(), ["mushrooms", "olives"]);
  assert.equal(mdyMultiCheckedProps(handle, "olives").checked, true);

  mdyMultiCheckedProps(handle, "mushrooms").onCheckedChange(false);
  assert.deepEqual(handle.value(), ["olives"]);
});

test("all recipes reflect the disabled state", () => {
  const rx = vanillaReactivity();
  const form = createForm(
    { name: field(""), terms: field(true), plan: field("pro") },
    { reactivity: rx },
  );
  const off = rx.signal(true);
  form.setDisabled("name", off.asReadonly());
  form.setDisabled("terms", off.asReadonly());
  form.setDisabled("plan", off.asReadonly());

  assert.equal(mdyInputProps(form.f.name).disabled, true);
  assert.equal(mdyCheckedProps(form.f.terms).disabled, true);
  assert.equal(mdyValueProps(form.f.plan).disabled, true);
  assert.equal(mdyMultiCheckedProps(form.f.plan, "x").disabled, true);
});

test("async pending and submit-time markAllTouched compose with the recipes", async () => {
  const form = createForm({
    user: field("", [required()], {
      asyncValidators: [
        async (v) => (v === "taken" ? ["Username is already taken"] : []),
      ],
    }),
  });
  const handle = form.f.user;

  mdyInputProps(handle).onChange({ target: { value: "taken" } });
  assert.equal(handle.pending(), true); // show a spinner next to the input
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(handle.pending(), false);
  assert.deepEqual(handle.errors().map((e) => e.message), [
    "Username is already taken",
  ]);
  // Still hidden: the field was never touched (programmatic set via recipe
  // onChange does not blur). A failed submit surfaces everything.
  assert.deepEqual(mdyTouchedErrors(handle), []);
  form.markAllTouched();
  assert.deepEqual(mdyTouchedErrors(handle).map((e) => e.message), [
    "Username is already taken",
  ]);
  form.destroy();
});
