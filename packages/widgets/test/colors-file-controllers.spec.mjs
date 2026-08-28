/**
 * The last two kinds the catalogue declared and nothing served.
 *
 * Colour and file were wired by hand in every renderer from loose transitions. What the transitions
 * never carried is the state around them — the text being typed as against the value being held,
 * and what a selection refused — and that is where each renderer made its own decision.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import { createColorsFieldController } from "../dist/index.js";
import { createFileFieldController } from "../dist/index.js";

function colors({ value = "", presets = ["#0084ff", "#ff0044"], validators = [] } = {}) {
  const rx = vanillaReactivity();
  const form = createForm({ c: field(value, validators) }, { reactivity: rx });
  return { form, controller: createColorsFieldController({ widgetId: "w", handle: form.f.c, presets }, rx) };
}

function files(options = {}) {
  const rx = vanillaReactivity();
  const form = createForm({ f: field([], options.validators ?? []) }, { reactivity: rx });
  return { form, controller: createFileFieldController({ widgetId: "w", handle: form.f.f, ...options }, rx) };
}

const file = (name, type, size = 10) => ({ name, type, size });

// ─── colours ─────────────────────────────────────────────────────────────────

test("a colour on its way to being one survives being typed", () => {
  const { controller, form } = colors();
  controller.dispatch({ type: "text", value: "#0" });
  // Three keystrokes from a colour. Committing would store black; rejecting would take the text away
  // from the person writing it.
  assert.equal(controller.state().text, "#0");
  assert.equal(form.f.c.value(), "", "a half-typed colour reached the form");

  controller.dispatch({ type: "text", value: "#0084ff" });
  assert.equal(form.f.c.value(), "#0084ff");
  controller.destroy(); form.destroy();
});

test("a preset is a decision and closes; typing is not and does not", () => {
  const { controller, form } = colors();
  controller.dispatch({ type: "open" });
  controller.dispatch({ type: "text", value: "#112233" });
  assert.equal(controller.state().open, true, "typing closed the overlay");

  const commands = controller.dispatch({ type: "preset", value: "#0084ff" });
  assert.equal(controller.state().open, false);
  assert.ok(commands.some((c) => c.type === "close-overlay"));
  assert.equal(form.f.c.touched(), true, "choosing a preset did not count as touching the field");
  controller.destroy(); form.destroy();
});

test("a swatch knows it is chosen whatever its capitalisation", () => {
  const { controller, form } = colors({ value: "#0084FF" });
  const chosen = controller.state().presets.find((p) => p.selected);
  // `#0084FF` and `#0084ff` are one colour. A swatch that fails to mark itself because of case is a
  // swatch nobody can tell is selected.
  assert.equal(chosen?.value, "#0084ff");
  controller.destroy(); form.destroy();
});

test("out of play, a colour paints no verdict", () => {
  const { controller, form } = colors({ validators: [required()] });
  assert.equal(controller.state().invalid, true);
  form.setDisabled("c", () => true);
  assert.equal(controller.state().invalid, false);
  controller.destroy(); form.destroy();
});

// ─── files ───────────────────────────────────────────────────────────────────

test("what a selection refused is shown, not dropped in silence", () => {
  const { controller, form } = files({ accept: ".pdf", multiple: true });
  controller.dispatch({ type: "select", files: [file("a.pdf", "application/pdf"), file("b.exe", "application/octet-stream")] });

  const state = controller.state();
  assert.deepEqual(state.files.map((f) => f.name), ["a.pdf"]);
  // Without this a person looks at a list missing the file they just chose, with nothing to say why.
  assert.deepEqual(state.rejected.map((f) => f.name), ["b.exe"]);
  assert.equal(form.f.f.value().length, 1);
  controller.destroy(); form.destroy();
});

test("the refusals are replaced by the next round, not accumulated", () => {
  const { controller, form } = files({ accept: ".pdf", multiple: true });
  controller.dispatch({ type: "select", files: [file("b.exe", "application/octet-stream")] });
  assert.equal(controller.state().rejected.length, 1);

  controller.dispatch({ type: "select", files: [file("a.pdf", "application/pdf")] });
  // Keeping the previous round would explain a file the person never offered this time.
  assert.deepEqual(controller.state().rejected, []);
  controller.destroy(); form.destroy();
});

test("nothing accepted keeps what is held rather than clearing it", () => {
  const { controller, form } = files({ accept: ".pdf", multiple: true });
  controller.dispatch({ type: "select", files: [file("a.pdf", "application/pdf")] });
  controller.dispatch({ type: "select", files: [file("b.exe", "application/octet-stream")] });

  assert.deepEqual(form.f.f.value().map((f) => f.name), ["a.pdf"],
    "a refused selection wiped the accepted one");
  controller.destroy(); form.destroy();
});

test("the dropzone stops being receptive when the pointer leaves", () => {
  const { controller, form } = files();
  controller.dispatch({ type: "dragover", over: true });
  assert.equal(controller.state().dragover, true);
  controller.dispatch({ type: "dragover", over: false });
  assert.equal(controller.state().dragover, false);
  controller.destroy(); form.destroy();
});

test("a field that cannot take a drop never lights up", () => {
  const { controller, form } = files();
  controller.setReadonly(true);
  controller.dispatch({ type: "dragover", over: true });
  // Highlighting a dropzone that will refuse the drop promises something it cannot do.
  assert.equal(controller.state().dragover, false);
  controller.destroy(); form.destroy();
});

test("clearing empties both the value and what was refused", () => {
  const { controller, form } = files({ accept: ".pdf", multiple: true });
  controller.dispatch({ type: "select", files: [file("a.pdf", "application/pdf"), file("b.exe", "application/octet-stream")] });
  controller.dispatch({ type: "clear" });
  assert.deepEqual(form.f.f.value(), []);
  assert.deepEqual(controller.state().rejected, []);
  controller.destroy(); form.destroy();
});
