/**
 * A select that does not filter is drawn by the platform. ADR 0176.
 *
 * A custom combobox with no filter box gives a keyboard user the arrows and nothing else — no way
 * to type towards an option, which a list of fifty needs. The control the platform already has
 * brings the typeahead, the keyboard model and the picker a phone puts up, and it is what the other
 * two renderers draw for this variant.
 *
 * The entry for "nothing chosen" is the part of this that is easy to leave out and expensive to
 * miss: without it index 0 is a real option, so the control reads the first label while the form
 * holds nothing — a field that looks answered and is not.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const OPTIONS = [
  { value: "rome", label: "Rome" },
  { value: "paris", label: "Paris" },
];

function mounted(definition) {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose, form } = mountMdyForm(host, [definition], { submitLabel: null });
  return { host, reactivity, dispose, form };
}

test("a select with nothing said about filtering is the platform's", async () => {
  const { host, reactivity, dispose } = mounted({ name: "city", kind: "select", options: OPTIONS });
  await reactivity.flush();

  const chooser = host.querySelector("select");
  assert.ok(chooser !== null,
    "the field drew a custom combobox for a select that does not filter, so a keyboard user has "
    + "the arrows and no way to type towards an option");
  assert.equal(host.querySelectorAll("[role='listbox']").length, 0,
    "a listbox was drawn beside the platform's own chooser, so the options are on the page twice");

  dispose();
  host.remove();
});

test("a select that filters keeps the combobox", async () => {
  const { host, reactivity, dispose } = mounted({
    name: "city", kind: "select", searchable: true, options: OPTIONS,
  });
  await reactivity.flush();

  assert.equal(host.querySelector("select"), null,
    "the platform's chooser has no filter box, so a select asked to filter cannot be one");
  assert.ok(host.querySelector("[role='combobox']") !== null);

  dispose();
  host.remove();
});

test("nothing chosen is an entry, and it cannot be chosen back into", async () => {
  const { host, reactivity, dispose } = mounted({ name: "city", kind: "select", options: OPTIONS });
  await reactivity.flush();

  const chooser = host.querySelector("select");
  const first = chooser.options[0];
  assert.equal(first.value, "",
    "the first entry is a real option, so the control reads its label while the form holds nothing");
  assert.equal(first.disabled, true, "the entry for the absence can be chosen, which chooses nothing");
  assert.equal(chooser.value, "", "the control is showing an option the form does not hold");

  dispose();
  host.remove();
});

test("the entry goes once something is chosen and nothing says otherwise", async () => {
  const { host, reactivity, dispose, form } = mounted({ name: "city", kind: "select", options: OPTIONS });
  await reactivity.flush();

  const chooser = host.querySelector("select");
  form.f.city.set("paris");
  await reactivity.flush();

  assert.equal(chooser.value, "paris", "the control does not show what the form holds");
  assert.equal([...chooser.options].some((one) => one.value === ""), false,
    "the list still offers 'nothing' after a choice, which is a row nobody can use");

  dispose();
  host.remove();
});

test("the entry stays where a placeholder gives the absence words", async () => {
  const { host, reactivity, dispose, form } = mounted({
    name: "city", kind: "select", placeholder: "Pick a city", options: OPTIONS,
  });
  await reactivity.flush();
  form.f.city.set("paris");
  await reactivity.flush();

  const chooser = host.querySelector("select");
  const entry = [...chooser.options].find((one) => one.value === "");
  assert.ok(entry !== undefined,
    "the document wrote words for the absence and the way back to it was taken off the list");
  assert.equal(entry.textContent.trim(), "Pick a city");

  dispose();
  host.remove();
});

test("an object-valued option puts that object in the model, not the first one", async () => {
  const rome = { id: 1, name: "Rome" };
  const paris = { id: 2, name: "Paris" };
  const { host, reactivity, dispose, form } = mounted({
    name: "city", kind: "select",
    options: [{ value: rome, label: "Rome" }, { value: paris, label: "Paris" }],
  });
  await reactivity.flush();

  const chooser = host.querySelector("select");
  const second = [...chooser.options].find((one) => one.textContent.trim() === "Paris");
  assert.ok(second !== undefined);
  assert.notEqual(second.value, "[object Object]",
    "every option carries the same value, so the browser cannot tell two choices apart");

  chooser.value = second.value;
  chooser.dispatchEvent(new window.Event("change", { bubbles: true }));
  await reactivity.flush();

  assert.equal(form.f.city.value(), paris,
    "the person chose the second and the first went into the model");

  dispose();
  host.remove();
});
