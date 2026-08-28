/**
 * The select, bound to a form like every other kind.
 *
 * It was the one built the other way round — options, a value and a callback, driven by eight
 * imperative setters — while every other kind reads a field handle. Two idioms in one package meant
 * a renderer used whichever the kind happened to have, and `multiselect` sat on the opposite side of
 * the split from its own sibling.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import { createSelectFieldController } from "../dist/index.js";

const OPTIONS = [
  { value: "fr", label: "France" },
  { value: "it", label: "Italy" },
];

function setup({ value = null, validators = [], options = OPTIONS } = {}) {
  const rx = vanillaReactivity();
  const form = createForm({ s: field(value, validators) }, { reactivity: rx });
  const controller = createSelectFieldController({ widgetId: "w", handle: form.f.s, options }, rx);
  return { rx, form, controller };
}

const drained = () => new Promise((resolve) => { setTimeout(resolve, 0); });

test("choosing writes through to the form", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "select", optionKey: "it" });
  assert.equal(form.f.s.value(), "it");
  assert.equal(form.f.s.dirty(), true);
  assert.equal(form.f.s.touched(), true);
  controller.destroy(); form.destroy();
});

test("the form drives the widget, not only the other way round", async () => {
  const { controller, form } = setup();
  // A draft restored, a server correction, another field's cross-field rule — none of them go
  // through the widget, and with only the setters as a way in the control would never hear about it.
  form.f.s.set("fr");
  await drained();
  assert.equal(controller.state().selectedValue, "fr", "the widget did not follow the form");
  controller.destroy(); form.destroy();
});

test("out of play, no verdict — read from the handle rather than taken on trust", async () => {
  const { controller, form } = setup({ validators: [required()] });
  await drained();
  assert.equal(controller.state().invalid, true);

  form.setDisabled("s", () => true);
  await drained();
  // The standalone controller takes `invalid` as a boolean from its caller, so a select was as right
  // about this as whoever wired it happened to be.
  assert.equal(controller.state().invalid, false, "a disabled select painted as failing");
  controller.destroy(); form.destroy();
});

test("a disabled field does not accept a choice", async () => {
  const { controller, form } = setup();
  form.setDisabled("s", () => true);
  await drained();
  controller.dispatch({ type: "select", optionKey: "it" });
  assert.equal(form.f.s.value(), null, "a disabled select wrote to the form");
  controller.destroy(); form.destroy();
});

test("a value the options do not contain is still the value", async () => {
  const { controller, form } = setup({ value: "de" });
  await drained();
  const shown = controller.state().options.map((o) => o.value);
  // Erasing it loses data the person could have fixed; hiding it shows a control that disagrees with
  // the form it is bound to.
  assert.ok(shown.includes("de"), "an unrecognised value vanished from the list");
  assert.equal(form.f.s.value(), "de");
  controller.destroy(); form.destroy();
});

test("options that arrive later replace the ones that were there", async () => {
  const { controller, form } = setup();
  controller.setOptions([{ value: "es", label: "Spain" }]);
  await drained();
  assert.deepEqual(controller.state().options.map((o) => o.value), ["es"]);
  controller.destroy(); form.destroy();
});

test("the options a host binds with are its own type", () => {
  /** @type {import("../dist/field/index.js").MdySelectFieldControllerOptions<string>} */
  const options = { widgetId: "w", handle: undefined, options: OPTIONS, loading: true };
  assert.equal(options.loading, true);
  // Loading is a parameter and not a form state on purpose: whether options have arrived is the
  // host's business, and a form has no opinion about it.
  assert.equal("loading" in options, true);
});

test("blur marks touched even where the choice does not", () => {
  const { controller, form } = setup();
  controller.dispatch({ type: "blur" });
  assert.equal(form.f.s.touched(), true);
  controller.destroy(); form.destroy();
});

/**
 * The projection is a function now, not only a type.
 *
 * Every other kind publishes the thing that turns its state into ARIA. This one published the shape
 * and kept the function, so a renderer wanting a select of its own had to rewrite the projection —
 * which is exactly what a renderer must never have to do.
 */
test("the projection is exported, so a renderer need not rewrite it", async () => {
  const { projectSelectA11y, defaultWidgetIdFactory } = await import("../dist/index.js");
  assert.equal(typeof projectSelectA11y, "function");

  const { controller, form } = setup();
  const state = controller.state();
  const projected = projectSelectA11y({
    widgetId: "w",
    idFactory: defaultWidgetIdFactory,
    open: state.open,
    activeKey: state.activeKey,
    selectedKey: state.selectedKey,
    disabled: state.disabled,
    readonly: state.readonly,
    invalid: state.invalid,
    loading: state.loading,
    visibleKeys: state.options.map((o) => String(o.value)),
  });
  assert.ok(projected.trigger, "the projection produced no trigger");
  assert.equal(projected.trigger.attributes["aria-haspopup"], "listbox");
  assert.ok(projected.options, "the projection produced no option list");
  controller.destroy(); form.destroy();
});
