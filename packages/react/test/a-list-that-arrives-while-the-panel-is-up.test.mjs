/**
 * A select whose options arrive after it is on screen, in the two shapes a host can hold one.
 *
 * The controller offers `setOptions` for exactly this — "a list that arrives after the control is on
 * screen" — and a host that calls it keeps the panel it already opened. A host that instead hands
 * the list in as configuration has no such call to make: the list is part of what the controller was
 * built from, so a new list is a new controller, and a new controller starts closed.
 *
 * Both are legitimate ways to hold a headless controller. What is not legitimate is for the choice
 * to be invisible: the same person, doing the same thing, sees the panel stay up under one host and
 * shut under another. This puts the two routes in one run so the difference is a measurement rather
 * than a reading of two files.
 *
 * The waits are not politeness. A reactive runtime schedules its effects rather than running them
 * inside the write, so a render count read in the same turn as the change is read before the host
 * has been told anything — and every assertion built on it says "nothing happened" about a control
 * that was about to move.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id='root'></div>", { pretendToBeVisual: true });
for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  if (globalThis[name] === undefined) globalThis[name] = dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { createForm, field, useMdySelectField, reactReactivity } = await import("../dist/index.js");
const { createSelectFieldController } = await import("@modyra/widgets");

const OPTIONS_BEFORE = [{ value: "a", label: "A" }];
const OPTIONS_AFTER = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

// One runtime per bench, not one per line: a handle and a controller built on two instances of the
// same kind are still two owners, and the cross-runtime diagnostic fires on what is otherwise a
// correct test — a warning that reads like a finding.
const benchFor = () => {
  const reactivity = reactReactivity();
  return { reactivity, handle: createForm({ pick: field(null) }, { reactivity }).f.pick };
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

test("the controller keeps the panel up when the list is replaced through it", () => {
  const { reactivity, handle } = benchFor();
  const controller = createSelectFieldController(
    { widgetId: "pick", handle, options: OPTIONS_BEFORE },
    reactivity,
  );
  controller.setOpen(true);
  assert.equal(controller.state().open, true, "the panel was not opened, so this measures nothing");

  controller.setOptions(OPTIONS_AFTER);

  assert.equal(controller.state().options.length, 2, "the new list did not arrive");
  assert.equal(controller.state().open, true,
    "setOptions closed the panel — the call that exists for a list arriving on screen cannot be the one that shuts it");
  controller.destroy();
});

test("the React hook shuts the panel when the same list is replaced as configuration", async () => {
  const { handle } = benchFor();
  let api;
  let renders = 0;
  function Probe({ options }) {
    api = useMdySelectField(handle, { widgetId: "pick", options });
    renders += 1;
    return null;
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  await act(async () => { root.render(React.createElement(Probe, { options: OPTIONS_BEFORE })); });
  assert.equal(api.state.options.length, 1, "the first list did not reach the controller");

  const before = renders;
  await act(async () => { api.setOpen(true); });
  await settle();
  assert.ok(renders > before, "opening the panel repainted nothing, so this bench cannot see a panel close either");
  assert.equal(api.state.open, true, "the panel was never opened, so the next assertion proves nothing");

  await act(async () => { root.render(React.createElement(Probe, { options: OPTIONS_AFTER })); });
  await settle();

  assert.equal(api.state.options.length, 2, "the new list never reached the controller");
  // Not a defect being pinned: it is the cost of holding the list as configuration, recorded so that
  // a change to either route has to look at the other one.
  assert.equal(api.state.open, false,
    "the hook kept the panel up across a list change — the controller was reused, which is the other "
    + "route, and this file's account of the difference is now wrong");

  await act(async () => { root.unmount(); });
});
