import assert from "node:assert/strict";
import test from "node:test";
import {
  createValueWidgetController,
} from "../dist/index.js";

test("scalar controller owns input, dirty and touched transitions", () => {
  const changes = [];
  const controller = createValueWidgetController({ kind: "textarea", value: "", onChange: (v) => changes.push(v) });
  assert.deepEqual(controller.dispatch({ type: "input", value: "hello" }),
    [{ type: "emit-change" }, { type: "mark-dirty" }, { type: "mark-touched" }]);
  assert.equal(controller.state().value, "hello");
  assert.equal(controller.state().dirty, true);
  // Typing is the act: it marks the field answerable, so leaving has nothing left to say.
  // ADR 0167.
  assert.equal(controller.state().touched, true);
  assert.deepEqual(controller.dispatch({ type: "blur" }), []);
  assert.deepEqual(changes, ["hello"]);
});

test("boolean and numeric transitions are controller-owned and bounded", () => {
  const toggle = createValueWidgetController({ kind: "toggle", value: false });
  toggle.dispatch({ type: "toggle" });
  assert.equal(toggle.state().value, true);
  const number = createValueWidgetController({ kind: "number", value: 9 });
  number.dispatch({ type: "increment", step: 2, max: 10 });
  assert.equal(number.state().value, 10);
  number.dispatch({ type: "decrement", step: 4, min: 8 });
  assert.equal(number.state().value, 8);
});

test("disabled scalar controllers ignore value transitions, and leaving says nothing", () => {
  const controller = createValueWidgetController({ kind: "checkbox", value: false, disabled: true });
  assert.deepEqual(controller.dispatch({ type: "toggle" }), []);
  assert.equal(controller.state().value, false);
  assert.deepEqual(controller.dispatch({ type: "blur" }), []);
  assert.equal(controller.state().touched, false);
});
