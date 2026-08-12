/**
 * The two things every host does with a controller, and the command runtime they all share.
 *
 * Seven adapters had the same command executor and the same subscription; fourteen of the
 * twenty-seven duplicated bodies in this workspace were one of them. These are the checks on what
 * replaced them — including the one the duplication was hiding.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createForm, field, required, vanillaReactivity } from "@modyra/core";
import { createCommandRuntime, fieldCommandHandlers, subscribeController } from "../dist/index.js";
import { createTextFieldController } from "../dist/field/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

/**
 * The shape of the contract, named so a rename cannot pass unnoticed.
 *
 * `MdyCommandRuntimeOptions` carries an `announcerId` and an `MdyCommandDefer`; `MdyCommandRuntime`
 * offers `execute`; `MdyCommandTarget` is the half of a handle a command writes back to, and
 * `MdyControllerNotify` is what a subscription calls. A type nothing names is a type nothing notices
 * changing.
 */
test("the runtime and the binding expose the shape they declare", () => {
  /** @type {import("../dist/index.js").MdyCommandDefer} */
  const defer = (run) => { run(); };
  /** @type {import("../dist/index.js").MdyCommandRuntimeOptions} */
  const options = { announcerId: "mdy-shape-announcer", defer };
  /** @type {import("../dist/index.js").MdyCommandRuntime} */
  const runtime = createCommandRuntime(options);
  assert.equal(typeof runtime.execute, "function");

  /** @type {import("../dist/index.js").MdyCommandTarget} */
  const target = { markAsTouched() {}, markAsDirty() {} };
  const handlers = fieldCommandHandlers(target);
  assert.deepEqual(Object.keys(handlers).sort(), ["onDirty", "onTouched", "setOpen"]);

  /** @type {import("../dist/index.js").MdyControllerNotify} */
  const notify = () => {};
  assert.equal(typeof notify, "function");
  assert.equal(typeof subscribeController, "function");
});

test("focus waits for the host, and everything else does not", () => {
  const order = [];
  let release = () => {};
  const runtime = createCommandRuntime({
    announcerId: "mdy-test-announcer",
    defer: (run) => { release = () => { order.push("deferred"); run(); }; },
  });

  const element = document.createElement("input");
  document.body.append(element);

  runtime.execute(
    [{ type: "focus", target: { part: "control" } }, { type: "mark-touched" }],
    () => element,
    { setOpen: () => undefined, onTouched: () => order.push("touched") },
  );

  assert.deepEqual(order, ["touched"], "a side effect that is not focus must not wait for a render");
  release();
  assert.deepEqual(order, ["touched", "deferred"]);
  element.remove();
});

test("nothing to defer means the host is not asked to render", () => {
  let asked = 0;
  const runtime = createCommandRuntime({
    announcerId: "mdy-test-announcer",
    defer: () => { asked += 1; },
  });
  runtime.execute([{ type: "mark-dirty" }], () => undefined, {
    setOpen: () => undefined,
    onDirty: () => undefined,
  });
  assert.equal(asked, 0, "a command list with no focus in it scheduled a render for nothing");
});

/**
 * What the subscription guarantees, and what it deliberately does not assume.
 *
 * Six of the eight hooks in the two hook-based adapters watched `state` alone. Measured, that is
 * currently sufficient — every controller's view is a function of its state — so this is not a bug
 * they had; it is a guarantee they were relying on without it being one. The subscription covers
 * both, so a controller that later derives its view from something else does not silently stop
 * re-rendering six hooks.
 */
/** This runtime schedules its effects, so a write is not observed until the queue drains. */
const drained = () => new Promise((resolve) => { setTimeout(resolve, 0); });

test("a subscription follows what the host renders, and stops when told", async () => {
  const rx = vanillaReactivity();
  const form = createForm({ f: field("", [required()]) }, { reactivity: rx });
  const controller = createTextFieldController({ widgetId: "w", handle: form.f.f, kind: "text" });

  let notified = 0;
  const stop = subscribeController(controller, rx, () => { notified += 1; });
  const baseline = notified;

  form.f.f.set("typed");
  await drained();
  assert.ok(notified > baseline, "a value change did not reach the host");

  stop();
  const afterStop = notified;
  form.f.f.set("more");
  await drained();
  assert.equal(notified, afterStop, "the subscription kept running after its teardown");
  form.destroy();
});

test("the view is read as well as the state, whether or not it currently differs", () => {
  const rx = vanillaReactivity();
  const form = createForm({ f: field("") }, { reactivity: rx });
  const reads = [];
  const controller = createTextFieldController({ widgetId: "w", handle: form.f.f, kind: "text" });
  const spy = {
    state: Object.assign(() => { reads.push("state"); return controller.state(); }, controller.state),
    view: Object.assign(() => { reads.push("view"); return controller.view(); }, controller.view),
    dispatch: controller.dispatch,
    destroy: controller.destroy,
  };

  const stop = subscribeController(spy, rx, () => {});
  assert.deepEqual(reads, ["state", "view"], "the subscription read only half of what a host draws");
  stop();
  form.destroy();
});

test("a control with no overlay still answers the whole command vocabulary", () => {
  const rx = vanillaReactivity();
  const form = createForm({ f: field("") }, { reactivity: rx });
  const handlers = fieldCommandHandlers(form.f.f);

  assert.equal(form.f.f.touched(), false);
  handlers.onTouched?.();
  assert.equal(form.f.f.touched(), true);

  handlers.onDirty?.();
  assert.equal(form.f.f.dirty(), true);

  // `setOpen` is a no-op rather than absent: one vocabulary, and a control that cannot open must
  // answer the question rather than crash on it.
  assert.doesNotThrow(() => handlers.setOpen(true));
  form.destroy();
});
