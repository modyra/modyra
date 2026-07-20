/**
 * Headless recipes for Vue component libraries (shadcn-vue, Reka UI,
 * Naive UI…). The composables below are the exact code published in
 * docs/guides/headless-recipes.md — keep the two in sync.
 *
 * Two contracts cover the libraries:
 * - native text inputs (shadcn-vue <Input>/<Textarea> forward attrs):
 *   :value + @input/@blur;
 * - modelValue components (Reka/shadcn-vue Checkbox, Switch, Select,
 *   RadioGroup): :model-value + @update:model-value, bound via v-bind.
 *
 * Form state is real Vue reactivity (shallowRef/computed under the hood),
 * so every recipe is just a computed wrapper — templates track them
 * natively.
 */
import { computed, effectScope } from "@vue/reactivity";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createVueForm, field, minLength, required } from "../dist/index.js";

// ─── Recipe code (mirrored in docs/guides/headless-recipes.md) ───────────────

/** Native text inputs; shadcn-vue <Input>/<Textarea> forward these attrs. */
function useMdyInputProps(handle) {
  return {
    value: computed(() => handle.value() ?? ""),
    disabled: computed(() => handle.disabled()),
    "aria-invalid": computed(
      () => (handle.touched() && !handle.valid()) || undefined,
    ),
    "aria-required": computed(() => handle.required() || undefined),
    onInput: (e) => handle.set(e.target.value),
    onBlur: () => handle.markAsTouched(),
  };
}

/**
 * Reka/shadcn-vue modelValue components (Checkbox, Switch, Select,
 * RadioGroup). `emptyValue` is what the component shows for Modyra's null
 * sentinel: "" for selects/radios, false for checkboxes/switches.
 */
function useMdyModelProps(handle, emptyValue = "") {
  return {
    modelValue: computed(() => handle.value() ?? emptyValue),
    "onUpdate:modelValue": (v) => handle.set(v === "" ? null : v),
    disabled: computed(() => handle.disabled()),
  };
}

/** One checkbox per option; the field holds an array of selected values. */
function useMdyMultiCheckedProps(handle, option) {
  const selected = () => (Array.isArray(handle.value()) ? handle.value() : []);
  return {
    modelValue: computed(() => selected().includes(option)),
    "onUpdate:modelValue": (checked) => {
      const current = selected();
      handle.set(
        checked === true
          ? [...current, option]
          : current.filter((v) => v !== option),
      );
    },
    disabled: computed(() => handle.disabled()),
  };
}

/** Errors render only after touch; submit calls form.markAllTouched(). */
function useMdyTouchedErrors(handle) {
  return computed(() => (handle.touched() ? handle.errors() : []));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("input recipe: typing sets the value, blur touches, a11y tracks state", () => {
  const scope = effectScope();
  scope.run(() => {
    const form = createVueForm({ email: field("", [required()]) });
    const handle = form.f.email;
    const props = useMdyInputProps(handle);
    const errors = useMdyTouchedErrors(handle);

    assert.equal(props.value.value, "");
    assert.equal(props["aria-required"].value, true);
    assert.equal(props["aria-invalid"].value, undefined); // pristine
    assert.deepEqual(errors.value, []);

    props.onInput({ target: { value: "a@b.co" } });
    assert.equal(handle.value(), "a@b.co");
    assert.equal(props.value.value, "a@b.co"); // computed tracks the field

    props.onBlur();
    assert.equal(handle.touched(), true);

    handle.set("");
    assert.equal(props["aria-invalid"].value, true); // touched + invalid
    assert.deepEqual(
      errors.value.map((e) => e.message),
      ["This field is required"],
    );
  });
  scope.stop();
});

test("model recipe: null maps to the component's empty value and back", () => {
  const scope = effectScope();
  scope.run(() => {
    const form = createVueForm({ plan: field(null, []), terms: field(null, []) });
    const select = useMdyModelProps(form.f.plan); // empty ""
    const checkbox = useMdyModelProps(form.f.terms, false); // empty false

    assert.equal(select.modelValue.value, "");
    assert.equal(checkbox.modelValue.value, false);

    select["onUpdate:modelValue"]("pro");
    assert.equal(form.f.plan.value(), "pro");

    checkbox["onUpdate:modelValue"](true);
    assert.equal(form.f.terms.value(), true);

    // Clearing a select restores the null sentinel, not an empty string.
    select["onUpdate:modelValue"]("");
    assert.equal(form.f.plan.value(), null);
  });
  scope.stop();
});

test("multi-checked recipe toggles options in an array field", () => {
  const scope = effectScope();
  scope.run(() => {
    const form = createVueForm({ toppings: field([], [minLength(1)]) });
    const handle = form.f.toppings;

    useMdyMultiCheckedProps(handle, "mushrooms")["onUpdate:modelValue"](true);
    useMdyMultiCheckedProps(handle, "olives")["onUpdate:modelValue"](true);
    assert.deepEqual(handle.value(), ["mushrooms", "olives"]);
    assert.equal(useMdyMultiCheckedProps(handle, "olives").modelValue.value, true);

    useMdyMultiCheckedProps(handle, "mushrooms")["onUpdate:modelValue"](false);
    assert.deepEqual(handle.value(), ["olives"]);
  });
  scope.stop();
});

test("recipes reflect the disabled state reactively", () => {
  const scope = effectScope();
  scope.run(() => {
    const form = createVueForm({ name: field(""), terms: field(true) });
    const input = useMdyInputProps(form.f.name);
    const checkbox = useMdyModelProps(form.f.terms, false);

    // setDisabled takes a Modyra signal (a zero-arg function): wrap Vue
    // refs/computed as `() => ref.value`.
    const off = computed(() => true);
    form.setDisabled("name", () => off.value);
    form.setDisabled("terms", () => off.value);

    assert.equal(input.disabled.value, true);
    assert.equal(checkbox.disabled.value, true);
  });
  scope.stop();
});
