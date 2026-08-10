/**
 * What a multiselect does with a value its options do not contain — today.
 *
 * ADR 0029 says a widget does not repair the model, and the multiselect keeps its word on that half:
 * the value stays. It does **not** keep the other half — the value is not shown, so a person sees
 * one chip while the form holds two values, and cannot remove the one they cannot see.
 *
 * These tests pin today's behaviour rather than the behaviour we want. They turn red when the gap is
 * closed, which is exactly when someone should come back and rewrite them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, vanillaReactivity } = await import("@modyra/core");

const options = [{ value: "food", label: "Food" }, { value: "drinks", label: "Drinks" }];

const host = () => {
  document.body.innerHTML = "";
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

test("the value is kept, as the rule requires", () => {
  const rx = vanillaReactivity();
  const form = createForm({ tags: field(["food", "imported-tag"]) }, { reactivity: rx });

  const container = host();
  renderField(container, { name: "tags", kind: "multiselect", label: "Tags", options }, form.f.tags, rx);

  assert.deepEqual(form.value().tags, ["food", "imported-tag"], "nothing erased it");
  assert.deepEqual(form.submitValue().tags, ["food", "imported-tag"], "and it is submitted");
});

test("TODAY: the value it cannot match is not shown, and cannot be removed", () => {
  const rx = vanillaReactivity();
  const form = createForm({ tags: field(["food", "imported-tag"]) }, { reactivity: rx });

  const container = host();
  renderField(container, { name: "tags", kind: "multiselect", label: "Tags", options }, form.f.tags, rx);

  const chips = [...container.querySelectorAll("[role='group'] button")].map((el) => el.textContent.trim());
  assert.equal(
    chips.some((text) => text.includes("imported-tag")),
    false,
    "the known gap: a chip grid built from the option list has nowhere to put a value the list " +
    "does not name, so the user sees one chip while the form holds two values",
  );
});
