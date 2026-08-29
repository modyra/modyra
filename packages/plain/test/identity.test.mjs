/**
 * Identity and ownership.
 *
 * Every other conformance test mounts one field and asks whether its anatomy is right. That cannot
 * see the failures in this file: put two selects on a page and nothing so far proves which popup
 * belongs to which trigger, or that two fields did not claim the same DOM id. The two-instance
 * fixture below is the thing that makes any of it observable, so it stays in the suite.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { defaultWidgetIdFactory } = await import("../../widgets/dist/index.js");

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

/** Two of each kind that owns a popup — the case a single-instance fixture cannot express. */
const TWO_OF_EACH = [
  { name: "selectOne", kind: "select", label: "Select one", searchable: true, options: OPTIONS },
  { name: "selectTwo", kind: "select", label: "Select two", searchable: true, options: OPTIONS },
  { name: "multiOne", kind: "multiselect", label: "Multi one", options: OPTIONS },
  { name: "multiTwo", kind: "multiselect", label: "Multi two", options: OPTIONS },
  { name: "dateOne", kind: "datepicker", label: "Date one" },
  { name: "dateTwo", kind: "datepicker", label: "Date two" },
];

function mount(fields) {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, fields, { submitLabel: null });
  return { host, mounted, dispose: () => { mounted.dispose(); host.remove(); } };
}

test("two instances of a kind each render their own root", () => {
  const { host, dispose } = mount(TWO_OF_EACH);
  for (const field of TWO_OF_EACH) {
    const roots = host.querySelectorAll(`[data-mdy-field="${field.name}"]`);
    assert.equal(roots.length, 1, `${field.name} rendered ${roots.length} roots`);
  }
  dispose();
});

test("no id is claimed twice across the whole document", () => {
  const { dispose } = mount(TWO_OF_EACH);
  const seen = new Map();
  for (const element of document.querySelectorAll("[id]")) {
    const id = element.getAttribute("id");
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([id, count]) => `${id} x${count}`);
  dispose();
  assert.deepEqual(duplicates, [], `ids claimed more than once: ${duplicates.join(", ")}`);
});

test("every ARIA reference resolves to exactly one element", () => {
  const { dispose } = mount(TWO_OF_EACH);
  const REFERENCES = ["aria-controls", "aria-labelledby", "aria-describedby", "aria-activedescendant", "aria-owns"];
  const offenders = [];
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of REFERENCES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      for (const id of value.split(/\s+/).filter(Boolean)) {
        const matches = document.querySelectorAll(`[id="${id}"]`);
        if (matches.length !== 1) offenders.push(`${attribute}=${id} resolves to ${matches.length}`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join(" / "));
  dispose();
});

test("a trigger's aria-controls names its own popup, not a sibling's", () => {
  const { host, dispose } = mount(TWO_OF_EACH);
  for (const name of ["selectOne", "selectTwo"]) {
    const root = host.querySelector(`[data-mdy-field="${name}"]`);
    const trigger = root.querySelector(".mdy-select__trigger");
    assert.ok(trigger, `${name} has no trigger`);
    const controls = trigger.getAttribute("aria-controls");
    assert.ok(controls, `${name}'s trigger names no popup`);
    const popup = document.getElementById(controls);
    assert.ok(popup, `${name}'s aria-controls points at nothing`);
    // The popup must belong to this field: either inside its root, or portalled but carrying the
    // id this trigger named and no other field's.
    const otherName = name === "selectOne" ? "selectTwo" : "selectOne";
    const otherRoot = host.querySelector(`[data-mdy-field="${otherName}"]`);
    assert.ok(!otherRoot.contains(popup), `${name}'s popup is inside ${otherName}`);
  }
  dispose();
});

test("mountMdyForm rejects two fields with the same name", () => {
  const host = document.createElement("div");
  document.body.append(host);
  assert.throws(
    () => mountMdyForm(host, [
      { name: "duplicated", kind: "text", label: "First" },
      { name: "duplicated", kind: "text", label: "Second" },
    ], { submitLabel: null }),
    /duplicated/,
    "two definitions sharing a name collapsed into one instead of being rejected",
  );
  host.remove();
});

test("a field named by path mounts, renders and reads back nested", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  // A flattened document names a nested field by its path. The form it mounts has to be readable:
  // rendering it and then throwing on `getValue()` is a form that cannot be submitted.
  const { form, reactivity, dispose } = mountMdyForm(host, [
    { name: "country", kind: "text", label: "Country" },
    { name: "shipping.city", kind: "text", label: "City" },
  ], { submitLabel: null });

  assert.deepEqual(form.getValue(), { country: "", shipping: { city: "" } });

  const city = host.querySelector('[data-mdy-field="shipping.city"] input');
  assert.ok(city, "the field named by path never reached the DOM");
  city.value = "Roma";
  city.dispatchEvent(new Event("input", { bubbles: true }));
  await reactivity.flush();
  assert.deepEqual(form.getValue(), { country: "", shipping: { city: "Roma" } }, "typing did not reach the nested value");

  dispose();
  host.remove();
});

test("a mounted form with ordinary names still reads its value", () => {
  const host = document.createElement("div");
  document.body.append(host);
  // The guard above is only worth having if it lets through everything it should: a name is refused
  // for the separator, not for being long, cased, digit-bearing or underscored.
  const { form, dispose } = mountMdyForm(host, [
    { name: "email", kind: "text", label: "Email" },
    { name: "line_1", kind: "text", label: "Line 1" },
    { name: "addressLine2", kind: "text", label: "Line 2" },
    { name: "zip5", kind: "text", label: "ZIP" },
  ], { submitLabel: null });
  assert.deepEqual(form.getValue(), { email: "", line_1: "", addressLine2: "", zip5: "" });
  dispose();
  host.remove();
});

test("a name containing the id delimiter is rejected", () => {
  const host = document.createElement("div");
  document.body.append(host);
  // `a` + part `label` and a field literally named `a__label` land on the same id, in different
  // roles, and the browser allows both — so getElementById, label[for] and every ARIA IDREF stop
  // being deterministic.
  assert.equal(defaultWidgetIdFactory.part("a", "label"), "a__label");
  assert.throws(
    () => mountMdyForm(host, [
      { name: "a", kind: "text", label: "A" },
      { name: "a__label", kind: "text", label: "Collides with a's label" },
    ], { submitLabel: null }),
    /a__label/,
    "a name carrying the id delimiter was accepted",
  );
  host.remove();
});
