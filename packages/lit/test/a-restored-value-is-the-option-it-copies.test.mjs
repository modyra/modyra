/**
 * A value restored from a draft is the option it copies, in a searchable select.
 *
 * A draft, a refetch or an import hands back a copy of an object option rather than the option
 * itself. The field shows that option's label, as the contract's `sameChoice` recognises it (ADR
 * 0216). Compared by identity, the trigger was blank while the model held a value.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const options = [
  { value: { id: 1, name: "Roma" }, label: "Roma" },
  { value: { id: 2, name: "Milano" }, label: "Milano" },
];

const triggerOf = (element) => element.querySelector("[aria-haspopup]");

test("the trigger names the option a copied value is", async () => {
  const form = createLitForm({ city: field({ name: "Milano", id: 2 }) });
  const element = await mount("mdy-select-field", (el) => {
    el.field = form.f.city;
    el.options = options;
    el.searchable = true;
    el.label = "City";
  });
  // The premise: this is the custom list, whose trigger carries the chosen label.
  assert.ok(triggerOf(element), "no trigger was drawn, so this is not the searchable shape");
  assert.match(triggerOf(element).textContent ?? "", /Milano/);
});

test("a value no option holds names none of them", async () => {
  // The control: a lookup that matched anything would put an option's label here too.
  const form = createLitForm({ city: field({ id: 3, name: "Napoli" }) });
  const element = await mount("mdy-select-field", (el) => {
    el.field = form.f.city;
    el.options = options;
    el.searchable = true;
    el.label = "City";
  });
  assert.doesNotMatch(triggerOf(element).textContent ?? "", /Roma|Milano/);
});
