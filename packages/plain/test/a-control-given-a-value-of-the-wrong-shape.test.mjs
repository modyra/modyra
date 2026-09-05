/**
 * A value of the wrong shape takes nothing off the page (ADR 0208).
 *
 * The engine holds what a document puts in the model and reports the field invalid; the control is
 * what shows that verdict, so it has to be drawn. A reader that assumes the kind's declared shape
 * throws while the widget is being drawn, and the field a person needed to read the problem from is
 * the one thing missing.
 *
 * Asked here of every declared kind rather than of the ones that were caught: the renderer takes the
 * kind by name, so the roster is the contract's own and a kind added to it is measured without
 * anyone remembering to add it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field } = await import("@modyra/core");
const { MDY_WIDGET_KINDS } = await import("@modyra/widgets");

/** Values no document should produce: wrong at the top level, and lists whose entries are wrong. */
const WRONG = ["a name", 7, {}, [], true, [null], [7], ["a name"]];

test("the roster is the contract's, and it is not empty", () => {
  // A derivation that silently found nothing would make everything below vacuously green.
  assert.ok(MDY_WIDGET_KINDS.length >= 17, `only ${MDY_WIDGET_KINDS.length} kinds declared`);
});

for (const kind of MDY_WIDGET_KINDS) {
  test(`a ${kind} stays on the page whatever the model was handed`, () => {
    for (const wrong of WRONG) {
      const form = createForm({ n: field(wrong) });
      const container = document.createElement("div");
      document.body.append(container);
      try {
        assert.doesNotThrow(
          () => renderField(container, {
            name: "n", kind, label: "Given",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }, form.f.n),
          `a ${kind} handed ${JSON.stringify(wrong)} threw while being drawn`,
        );
        assert.ok(
          container.querySelector("input, select, textarea, button") !== null,
          `a ${kind} handed ${JSON.stringify(wrong)} drew no control, so there is nothing left to show the verdict on`,
        );
      } finally {
        container.remove();
        document.body.innerHTML = "";
      }
    }
  });
}
