/**
 * The name a control announces, on a document that wrote no caption.
 *
 * `aria-labelledby` wins over `aria-label` in the name computation, and it wins even when it points
 * at an element that is not on the page: the reference is not "tried and abandoned", it produces an
 * empty name and the fallback beside it is never consulted. So a projection that emits a caption's
 * id unconditionally, on a field whose caption was never drawn, does not leave the name alone — it
 * replaces it with nothing.
 *
 * The contract already answers this question. `fieldNameAttributes` returns the caption's id when
 * there is a caption and the words themselves when there is none, and says why in its own comment:
 * "a reference to an empty element would be a name that resolves to nothing".
 *
 * Read as a reader would: the resolved name, never the attribute that was written.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** What a reader announces for an element: labelledby first, and it does not fall back when it dangles. */
function announced(element) {
  const points = element.getAttribute("aria-labelledby");
  if (points !== null && points.trim() !== "") {
    return points
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
      .trim();
  }
  return (element.getAttribute("aria-label") ?? "").trim();
}

function mount(field) {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [field], { submitLabel: null });
  return host;
}

test("a multiselect with no caption still announces a name", async () => {
  const host = mount({
    name: "tags",
    kind: "multiselect",
    ariaLabel: "Tags",
    options: [{ value: "food", label: "Food" }],
  });
  await settle();

  const trigger = host.querySelector(".mdy-multiselect__trigger");
  assert.ok(trigger, "the field drew no trigger, so no name was read");

  const points = trigger.getAttribute("aria-labelledby");
  if (points !== null && points.trim() !== "") {
    const targets = points.split(/\s+/).map((id) => trigger.ownerDocument.getElementById(id));
    assert.ok(targets.every(Boolean),
      `aria-labelledby points at ${points}, and no element on the page carries that id — the name it `
      + "resolves to is empty, and the aria-label beside it is never consulted");
  }

  assert.notEqual(announced(trigger), "",
    "the control announces no name at all: the reference it carries resolves to nothing, and a "
    + "reader hears only its role");
});
