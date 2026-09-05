/**
 * A value of the wrong shape is a verdict, not a crash.
 *
 * The engine takes what a document hands it, holds it, and reports the field invalid — the value
 * stays in the model and `canSubmit` is false. A projection that assumes its kind's declared shape
 * turns that verdict into a thrown error, and the widget that was supposed to *show* the verdict
 * disappears from the page instead.
 *
 * Every renderer draws from these projections, so a single unguarded read is a defect in all of
 * them at once. The roster below is derived from the public door rather than written down: a kind
 * added to the contract is measured here without anyone remembering to add it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field } from "../../core/dist/index.js";
import * as widgets from "../dist/index.js";

/** Values no document should produce: wrong at the top level, and lists whose entries are wrong. */
const WRONG = ["a name", 7, {}, [], null, true, [null], [7], ["a name"]];

/** Every field controller the package offers, by the name it offers it under. */
const CONTROLLERS = Object.entries(widgets)
  .filter(([name, value]) => /^create\w+FieldController$/.test(name) && typeof value === "function")
  .map(([name, create]) => [name.replace(/^create|FieldController$/g, "").toLowerCase(), create]);

test("the roster is the public door's, and it is not empty", () => {
  // A derivation that silently found nothing would make every test below vacuously green.
  assert.ok(CONTROLLERS.length >= 10, `only ${CONTROLLERS.length} controllers reached from the barrel`);
});

for (const [kind, create] of CONTROLLERS) {
  test(`a ${kind} projects itself whatever the model was handed`, () => {
    for (const wrong of WRONG) {
      const form = createForm({ x: field(wrong) });
      const options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
      let view;
      assert.doesNotThrow(
        () => { view = create({ handle: form.f.x, widgetId: "x", options }).view(); },
        `handed ${JSON.stringify(wrong)}, the ${kind} projection threw — a widget that cannot draw itself cannot report the verdict either`,
      );
      assert.ok(
        view !== undefined && Object.keys(view.parts).length > 0,
        `handed ${JSON.stringify(wrong)}, the ${kind} projected no parts at all`,
      );
    }
  });
}

test("the premise: the engine holds the value rather than refusing it", () => {
  // Without this the tests above assert that a widget survives something that never reaches it. The
  // verdict on a wrong shape — the field invalid, `canSubmit` false — belongs to the kind's rule and
  // is measured where a kind is mounted; what a projection has to survive is the value being there.
  const form = createForm({ x: field("a name") });
  assert.equal(form.f.x.value(), "a name", "the engine refused the value instead of holding it");
});
