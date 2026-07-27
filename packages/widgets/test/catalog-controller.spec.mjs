import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogWidgetController, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "../dist/index.js";

test("every catalog controller exposes its typed anatomy through the runtime view", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const controller = createCatalogWidgetController(kind);
    const view = controller.view();
    assert.equal(view.structure.kind, kind);
    assert.deepEqual(view.root.classes, MDY_WIDGET_CONTRACTS[kind].rootClasses);
    assert.deepEqual(Object.keys(view.parts), Object.keys(MDY_WIDGET_CONTRACTS[kind].parts));
    controller.destroy();
  }
});

test("overlay controllers own open, close and focus restoration commands", () => {
  const controller = createCatalogWidgetController("select");
  assert.deepEqual(controller.dispatch({ type: "open" }), [{ type: "open-overlay", anchor: { part: "trigger" } }]);
  assert.equal(controller.state().open, true);
  assert.deepEqual(controller.dispatch({ type: "close", restoreFocus: true }), [
    { type: "close-overlay" },
    { type: "restore-focus", target: { part: "trigger" } },
  ]);
  assert.equal(controller.state().open, false);
});

test("disabled catalog controllers remain inert", () => {
  const controller = createCatalogWidgetController("colors");
  controller.dispatch({ type: "disable", disabled: true });
  assert.deepEqual(controller.dispatch({ type: "open" }), []);
  assert.equal(controller.state().open, false);
});
