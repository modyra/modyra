/**
 * A widget that declares nothing about a panel is not a widget with a closed one.
 *
 * The canonical observation reads open-ness from `aria-expanded` on the opener the contract names,
 * because renderers hide a closed panel in ways a DOM inspection without layout cannot see. What the
 * reading has to keep apart is silence: a kind with an overlay capability can be drawn in a variant
 * that has no overlay of its own — a select with no search renders the platform's chooser, whose
 * expanded state belongs to the platform and is declared nowhere.
 *
 * Read as a boolean, that silence answers "closed", which is the same answer a correct closed panel
 * gives. Every check built on it then passes on a widget it never saw.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../../plain/dist/index.js");
const { createForm, field } = await import("../../core/dist/index.js");
const { canonicalWidgetSnapshot } = await import("../dist/testing/index.js");

const draw = (definition) => {
  const form = createForm({ n: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  renderField(host, { name: "n", label: "G", options: [{ value: "a", label: "A" }], ...definition }, form.f.n);
  return { root: host.firstElementChild, host, handle: form.f.n };
};

test("a kind drawn without an overlay of its own says so", () => {
  // The platform's chooser: the contract gives this kind an overlay capability, and this variant of
  // it has none.
  const { root, host } = draw({ kind: "select" });
  assert.equal(host.querySelector(".mdy-select__trigger")?.tagName, "SELECT", "this variant no longer draws the platform's chooser, so it is the wrong subject");
  assert.equal(canonicalWidgetSnapshot(root, "select", { document }).overlay, "absent");
});

test("and a kind that does draw one reports it closed, then open", async () => {
  const { root, host } = draw({ kind: "select", searchable: true });
  const trigger = host.querySelector(".mdy-select__trigger");
  assert.equal(trigger?.tagName, "BUTTON", "this variant no longer draws its own panel, so it is the wrong subject");
  assert.equal(canonicalWidgetSnapshot(root, "select", { document }).overlay, "closed");
  trigger.click();
  // The opener writes what it says after the event settles; read in the same turn, the answer is
  // about the moment before the press.
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "the press did not open the panel, so the reading below is about nothing");
  assert.equal(canonicalWidgetSnapshot(root, "select", { document }).overlay, "open");
});

test("a kind with no overlay capability at all is absent, as it always was", () => {
  const { root } = draw({ kind: "text" });
  assert.equal(canonicalWidgetSnapshot(root, "text", { document }).overlay, "absent");
});
