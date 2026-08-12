/**
 * A handle is observed by the runtime that owns it.
 *
 * The defect has been had and fixed once already, in two places. `CHANGELOG.md` records it: a binding
 * built a fresh `vanillaReactivity()` to observe a handle, which worked only because vanilla's
 * tracking is global to the module, and never re-rendered — silently — for a handle owned by another
 * adapter's form. `getFieldHandleOwner` was added for it and reached two of roughly seventeen callers.
 *
 * `MdyCrossRuntimeObservationError` and `MDY_CROSS_RUNTIME_OBSERVATION` were declared at the same
 * time and constructed by nothing, which is why the other fifteen went unnoticed. These are the
 * checks that the resolution happens and that a mismatch is named.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForm,
  field,
  getFieldHandleOwner,
  observerFor,
  vanillaReactivity,
  MDY_CROSS_RUNTIME_OBSERVATION,
} from "../dist/index.js";

/** Collects what a caller would otherwise have to notice by eye. */
function reporter() {
  const seen = [];
  return { seen, report: (diagnostic) => seen.push(diagnostic) };
}

test("a handle carries the runtime that built it", () => {
  const rx = vanillaReactivity();
  const form = createForm({ a: field("") }, { reactivity: rx });
  assert.equal(getFieldHandleOwner(form.f.a), rx, "the handle was never tagged with its owner");
  form.destroy();
});

test("asked for nothing, a caller is given the owner rather than a fresh runtime", () => {
  const rx = vanillaReactivity();
  const form = createForm({ a: field("") }, { reactivity: rx });
  assert.equal(observerFor(form.f.a), rx);
  form.destroy();
});

test("a hand-built handle has no owner, and that is not an error", () => {
  const rx = vanillaReactivity();
  const handle = { value: rx.signal(""), errors: rx.signal([]) };
  const resolved = observerFor(handle);
  assert.ok(resolved && typeof resolved.signal === "function",
    "a handle nobody registered must still yield a usable runtime");
});

test("a runtime the caller asked for is honoured, and the mismatch is named", () => {
  const owner = vanillaReactivity();
  const stranger = { ...vanillaReactivity(), kind: "stranger" };
  const form = createForm({ a: field("") }, { reactivity: owner });
  const diagnostics = reporter();

  const used = observerFor(form.f.a, stranger, diagnostics);

  // Honoured: overriding a runtime a caller passed on purpose would hide the mistake rather than
  // report it, and a host with its own scheduling has a right to be believed.
  assert.equal(used, stranger, "an explicit runtime must not be silently replaced");
  assert.equal(diagnostics.seen.length, 1, "the mismatch was not reported");
  assert.equal(diagnostics.seen[0].code, MDY_CROSS_RUNTIME_OBSERVATION);
  assert.equal(diagnostics.seen[0].severity, "error");
  assert.match(diagnostics.seen[0].message, /does not own/);
  form.destroy();
});

test("asking for the runtime that does own it says nothing", () => {
  const owner = vanillaReactivity();
  const form = createForm({ a: field("") }, { reactivity: owner });
  const diagnostics = reporter();
  assert.equal(observerFor(form.f.a, owner, diagnostics), owner);
  assert.deepEqual(diagnostics.seen, [], "observing through the owner is not a finding");
  form.destroy();
});

test("a controller handed no runtime observes through the form's", async () => {
  const { createFieldController } = await import("../../widgets/dist/field/index.js");
  const owner = vanillaReactivity();
  const form = createForm({ a: field("x") }, { reactivity: owner });

  const controller = createFieldController({ widgetId: "w", handle: form.f.a, kind: "text" });
  // The proof is that it follows: a controller on an unrelated runtime reads the first value and
  // then never hears about another one.
  assert.equal(controller.state().value, "x");
  form.f.a.set("y");
  assert.equal(controller.state().value, "y", "the controller did not follow the form it belongs to");

  controller.destroy();
  form.destroy();
});
