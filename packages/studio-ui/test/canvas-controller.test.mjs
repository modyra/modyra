import assert from "node:assert/strict";
import { test } from "node:test";
import {
  StudioCanvasController,
  StudioElementRegistry,
  StudioRuntimeSession,
} from "../dist/canvas-controller.js";

test("StudioRuntimeSession disposes a replaced session once and ignores the same instance", () => {
  const disposed = [];
  const first = { dispose: () => disposed.push("first") };
  const second = { dispose: () => disposed.push("second") };
  const session = new StudioRuntimeSession();

  session.replace(first);
  session.replace(first);
  assert.deepEqual(disposed, []);
  session.replace(second);
  assert.deepEqual(disposed, ["first"]);
  session.dispose();
  session.dispose();
  assert.deepEqual(disposed, ["first", "second"]);
});

test("StudioElementRegistry refreshes stable node-ID lookups", () => {
  const city = { dataset: { node: "nd_city" } };
  const zip = { dataset: { node: "nd_zip" } };
  const registry = new StudioElementRegistry();

  registry.refresh({ querySelectorAll: () => [city, zip] });
  assert.equal(registry.get("nd_city"), city);
  assert.equal(registry.get("missing"), null);

  registry.refresh({ querySelectorAll: () => [zip] });
  assert.equal(registry.get("nd_city"), null);
  assert.equal(registry.get("nd_zip"), zip);
});

test("StudioCanvasController preserves the viewport across a shell rebuild", () => {
  const firstNode = { dataset: { node: "nd_first" } };
  const firstCanvas = {
    scrollLeft: 17,
    scrollTop: 91,
    querySelectorAll: () => [firstNode],
  };
  const secondNode = { dataset: { node: "nd_second" } };
  const secondCanvas = {
    scrollLeft: 0,
    scrollTop: 0,
    querySelectorAll: () => [secondNode],
  };
  const controller = new StudioCanvasController();

  controller.connect(firstCanvas);
  firstCanvas.scrollLeft = 17;
  firstCanvas.scrollTop = 91;
  controller.capture();
  controller.connect(secondCanvas);

  assert.equal(secondCanvas.scrollLeft, 17);
  assert.equal(secondCanvas.scrollTop, 91);
  assert.equal(controller.elementForNode("nd_first"), null);
  assert.equal(controller.elementForNode("nd_second"), secondNode);

  controller.dispose();
  assert.equal(controller.elementForNode("nd_second"), null);
});
