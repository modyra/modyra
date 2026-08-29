/**
 * A caption a document did not write does not stand where a caption stands.
 *
 * A field named `rows.0.code` and given no caption still needs a name: everything inside the shell is
 * named by pointing at the label, and a reference resolving to an empty element announces the role
 * and nothing else. So the label carries the field's own key.
 *
 * What it must not do is *look* like a caption somebody meant. A leaked key and a real label are
 * indistinguishable in the position and styling of one, and a person reading the form cannot tell it
 * is incomplete — which is worse than showing nothing, because nothing is legible as nothing.
 *
 * `mdy-label--unwritten` is what keeps it out of sight while leaving it where a reader can follow a
 * reference to it — visually hidden rather than `display: none`, which would take it out of the tree
 * along with everything pointing at it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

function mounted(definition) {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose } = mountMdyForm(host, [definition], { submitLabel: null });
  return { host, reactivity, dispose };
}

test("the key stands in for a caption, and is marked as standing in", async () => {
  const { host, reactivity, dispose } = mounted({ name: "rows.0.code", kind: "text" });
  await reactivity.flush();

  const label = host.querySelector("label");
  assert.ok(label !== null, "no label at all: every reference that points at one resolves to nothing");
  assert.equal(label.textContent.trim(), "rows.0.code",
    "the caption says something other than the field's key, so a reference to it names the wrong thing");
  assert.ok(label.classList.contains("mdy-label--unwritten"),
    "the field's own key is standing in the position and styling of a caption somebody meant. A "
    + "reader cannot tell the form is incomplete, which is worse than showing nothing");

  dispose?.();
  host.remove();
});

test("and a caption somebody wrote is not marked as one nobody did", async () => {
  // The control. Without it the class could be applied always and the check above would pass while
  // every real caption on every form was hidden.
  const { host, reactivity, dispose } = mounted({ name: "code", kind: "text", label: "Codice" });
  await reactivity.flush();

  const label = host.querySelector("label");
  assert.equal(label.textContent.trim().replace("*", "").trim(), "Codice");
  assert.ok(!label.classList.contains("mdy-label--unwritten"),
    "a caption a document wrote is hidden from sight, so the form shows no labels at all");

  dispose?.();
  host.remove();
});
