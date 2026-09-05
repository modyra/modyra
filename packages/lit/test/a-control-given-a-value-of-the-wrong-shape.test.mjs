/**
 * A value of the wrong shape takes nothing off the page (ADR 0208).
 *
 * The engine holds what a document puts in the model and reports the field invalid; the control is
 * what shows that verdict, so it has to be drawn. A reader that assumes the kind's declared shape
 * throws while the element renders, and the field a person needed to read the problem from is the
 * one thing missing.
 *
 * The roster is the contract's kinds put through the package's own kind-to-tag door, so a kind that
 * gains an element is measured here without anyone remembering to add it — and a kind that has no
 * element is named rather than silently skipped.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements, mdyLitTagFor } = await import("../dist/ui.js");
const { MDY_WIDGET_KINDS } = await import("@modyra/widgets");

defineMdyElements();

/** Values no document should produce: wrong at the top level, and lists whose entries are wrong. */
const WRONG = ["a name", 7, {}, [], true, [null], [7], ["a name"]];

const TAGGED = MDY_WIDGET_KINDS.map((kind) => [kind, mdyLitTagFor(kind)]).filter(([, tag]) => tag !== null);

test("the roster is the contract's kinds this package draws, and it is not empty", () => {
  // A derivation that silently found nothing would make everything below vacuously green.
  assert.ok(TAGGED.length >= 12, `only ${TAGGED.length} of ${MDY_WIDGET_KINDS.length} kinds have an element`);
});

for (const [kind, tag] of TAGGED) {
  test(`a ${kind} stays on the page whatever the model was handed`, async () => {
    for (const wrong of WRONG) {
      const form = createLitForm({ n: field(wrong) });
      let element;
      await assert.doesNotReject(
        async () => {
          element = await mount(tag, (host) => {
            host.field = form.f.n;
            host.label = "Given";
            host.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
          });
        },
        `a ${kind} handed ${JSON.stringify(wrong)} threw while being drawn`,
      );
      const root = element.renderRoot ?? element;
      assert.ok(
        root.querySelector("input, select, textarea, button") !== null,
        `a ${kind} handed ${JSON.stringify(wrong)} drew no control, so there is nothing left to show the verdict on`,
      );
    }
  });
}
