/**
 * A value of the wrong shape takes nothing off the page (ADR 0208).
 *
 * The engine holds what a document puts in the model and reports the field invalid; the control is
 * what shows that verdict, so it has to be drawn. A component that assumes the kind's declared shape
 * throws while rendering, and the field a person needed to read the problem from is the one thing
 * missing.
 *
 * The roster is derived from the package's own door, so a component added to it is measured without
 * anyone remembering to add it — including the kinds this package has not drawn yet.
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
const m = await import("../dist/index.js");
const { createForm, field } = m;

/** Values no document should produce: wrong at the top level, and lists whose entries are wrong. */
const WRONG = ["a name", 7, {}, [], true, [null], [7], ["a name"]];

/** Every field component the package offers, by the name it offers it under. */
const FIELDS = Object.entries(m).filter(([name, value]) => /^Mdy\w+Field$/.test(name) && value !== undefined);

test("the roster is the package's own, and it is not empty", () => {
  // A derivation that silently found nothing would make everything below vacuously green.
  assert.ok(FIELDS.length >= 5, `only ${FIELDS.length} field components reached from the barrel`);
});

for (const [name, Component] of FIELDS) {
  test(`${name} stays on the page whatever the model was handed`, () => {
    for (const wrong of WRONG) {
      const handle = createForm({ n: field(wrong) }).f.n;
      const host = dom.window.document.createElement("div");
      dom.window.document.body.append(host);
      const root = createRoot(host);
      try {
        assert.doesNotThrow(
          () => act(() => {
            root.render(React.createElement(Component, {
              field: handle, widgetId: "n", label: "Given",
              options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
            }));
          }),
          `${name} handed ${JSON.stringify(wrong)} threw while being drawn`,
        );
        assert.ok(
          host.querySelector("input, select, textarea, button") !== null,
          `${name} handed ${JSON.stringify(wrong)} drew no control, so there is nothing left to show the verdict on`,
        );
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    }
  });
}
