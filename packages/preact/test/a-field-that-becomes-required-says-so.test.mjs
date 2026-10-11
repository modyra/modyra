/**
 * A field that becomes required, or gains a bound, re-renders the component that reads it.
 *
 * The field hook returns `required` and `constraints` for `aria-required` and native bounds on the
 * consumer's own control. The store a component subscribes to decides when it re-renders, so a
 * signal the hook returns and the store does not watch leaves the control describing a rule that
 * is no longer the field's. The value here is already valid, so neither change moves the errors or
 * the verdict: a notification can only come from the signal under test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFieldStore, vanillaReactivity } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * A handle whose members are independent signals, so one of them can change alone. A real form
 * recomputes its errors when a rule is added, and that would notify the store whatever it watches.
 */
function watched() {
  const rx = vanillaReactivity();
  const required = rx.signal(false);
  const constraints = rx.signal({});
  const handle = {
    path: "email",
    value: rx.signal("x"), errors: rx.signal([]), touched: rx.signal(false), dirty: rx.signal(false),
    valid: rx.signal(true), pending: rx.signal(false), disabled: rx.signal(false), readonly: rx.signal(false),
    interactivity: rx.signal("enabled"), required, constraints,
    set() {}, markAsTouched() {}, markAsDirty() {},
  };
  const store = createFieldStore(handle);
  let notified = 0;
  store.subscribe(() => notified++);
  return { required, constraints, store, notified: () => notified };
}

test("a field that becomes required notifies the component", async () => {
  const view = watched();
  view.required.set(true);
  await tick();
  assert.ok(view.notified() >= 1, "required turned on and the component was not told");
  view.store.destroy();
});

test("a field that gains a bound notifies the component", async () => {
  const view = watched();
  view.constraints.set({ maxLength: 10 });
  await tick();
  assert.ok(view.notified() >= 1, "the field gained a bound and the component was not told");
  view.store.destroy();
});

test("a change to nothing the component reads leaves it alone", async () => {
  // The control of the two above: a store that notified on every tick would pass them too.
  const view = watched();
  await tick();
  assert.equal(view.notified(), 0);
  view.store.destroy();
});
