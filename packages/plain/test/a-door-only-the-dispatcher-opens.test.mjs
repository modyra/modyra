/**
 * The seven per-kind renderers, and the validator pass, called the way a consumer calls them.
 *
 * Every one of these is a published name, and every one of them was reached only through
 * `renderField`, which picks the kind and fills in the arguments after it. A door exercised only by
 * the dispatcher standing in front of it is a door nobody has opened: the dispatcher passes what the
 * dispatcher passes, so the *positions* of `mode`, of the calendar bounds, of the time format — which
 * differ from one renderer to the next and are the part a caller gets wrong — are pinned by nothing.
 *
 * So each is called directly, positionally, and asked for the two things its signature promises: it
 * draws the kind it is named for, and what it hands back takes that drawing away again.
 *
 * The root class is read from the contract rather than written here. `radio` draws
 * `mdy-renderer--radio-group`, not `mdy-renderer--radio`, and a literal in this file would say
 * otherwise while staying green.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { vanillaReactivity } from "@modyra/core";
import { MDY_ID_DELIMITER, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const {
  applyFieldValidators, buildForm,
  renderBooleanField, renderDatepickerField, renderMultiselectField, renderOptionField,
  renderSelectField, renderTextField, renderTimepickerField,
} = await import("../dist/index.js");

const OPTIONS = [{ value: "IT", label: "Italy" }, { value: "FR", label: "France" }];

/**
 * A name no field carries, so that the argument holding it is the one being read.
 *
 * Every id a widget emits is built from it. Passing the field's own name instead would leave the
 * assertion green whichever argument the renderer picked it up from, and the fifth position — where
 * `mode`, the calendar bounds and the time format sit for three of these doors and nothing sits for
 * the other four — is exactly what a caller gets wrong.
 */
const WIDGET_ID = "zz-only-here";

/**
 * One row per published door: the field it is given, and the call itself.
 *
 * The call is written out rather than derived because the argument order is what is under test —
 * `mode` sits fifth for multiselect, the calendar bounds fifth for datepicker, the format fifth for
 * timepicker, and nothing sits there for the other four.
 */
const DOORS = [
  {
    door: "renderTextField", kind: "text",
    field: { name: "note", kind: "text" },
    open: (container, f, handle, rx) => renderTextField(container, f, handle, rx, WIDGET_ID),
  },
  {
    door: "renderBooleanField", kind: "checkbox",
    field: { name: "agreed", kind: "checkbox" },
    open: (container, f, handle, rx) => renderBooleanField(container, f, handle, rx, WIDGET_ID),
  },
  {
    door: "renderOptionField", kind: "radio",
    field: { name: "where", kind: "radio", options: OPTIONS },
    open: (container, f, handle, rx) => renderOptionField(container, f, handle, rx, WIDGET_ID),
  },
  {
    door: "renderSelectField", kind: "select",
    field: { name: "country", kind: "select", options: OPTIONS },
    open: (container, f, handle, rx) => renderSelectField(container, f, handle, rx, WIDGET_ID),
  },
  {
    door: "renderMultiselectField", kind: "multiselect",
    field: { name: "countries", kind: "multiselect", options: OPTIONS },
    open: (container, f, handle, rx) => renderMultiselectField(container, f, handle, rx, "many", WIDGET_ID),
  },
  {
    door: "renderDatepickerField", kind: "datepicker",
    field: { name: "day", kind: "datepicker" },
    open: (container, f, handle, rx) =>
      renderDatepickerField(container, f, handle, rx, { minDate: "2026-01-01" }, WIDGET_ID),
  },
  {
    door: "renderTimepickerField", kind: "timepicker",
    field: { name: "at", kind: "timepicker" },
    open: (container, f, handle, rx) => renderTimepickerField(container, f, handle, rx, "24h", WIDGET_ID),
  },
];

function rootClassOf(kind) {
  const classes = MDY_WIDGET_CONTRACTS[kind].parts.root.classes;
  const own = classes.filter((one) => one !== "mdy-renderer");
  assert.equal(own.length, 1, `${kind} declares ${own.length} root classes of its own, so this test cannot say which one names it`);
  return own[0];
}

for (const { door, kind, field, open } of DOORS) {
  test(`${door} draws its kind when called directly`, async () => {
    const rx = vanillaReactivity();
    const form = buildForm([field], rx);
    const container = document.createElement("div");
    document.body.append(container);

    const dispose = open(container, field, form.f[field.name], rx);
    await rx.flush();

    const expected = rootClassOf(kind);
    assert.ok(container.querySelector(`.${expected}`) !== null,
      `${door} drew nothing carrying ${expected}, so the door named for this kind draws another one`);

    const ids = [...container.querySelectorAll("[id]")].map((one) => one.id);
    assert.ok(ids.length > 0, `${door} emitted no ids at all, so nothing here reads the name it was given`);
    // The bare name is an id in its own right — the widget's own element wears it, and the parts
    // hang off it through the delimiter.
    assert.deepEqual(ids.filter((id) => id !== WIDGET_ID && !id.startsWith(`${WIDGET_ID}${MDY_ID_DELIMITER}`)), [],
      `${door} built ids from something other than the name in that argument position — the caller's `
      + `references point at elements that are not there`);

    assert.equal(typeof dispose, "function",
      `${door} hands back something a caller cannot dispose, so a host mounting it leaks the widget`);
    dispose();
    assert.equal(container.querySelector(`.${expected}`), null,
      `${door}'s disposer left the widget on the page`);

    container.remove();
    form.deactivate();
  });
}

/**
 * The validator pass, and the one observation that belongs to it alone.
 *
 * Applying it to a fresh form and finding the value rejected proves nothing: the schema carries the
 * same rules, so a form built from the field list rejects it either way and this function could be
 * empty. What only this call does is *replace* — it writes under one key, so handing it a second
 * reading of the same fields takes the first reading off a form that is already live.
 *
 * That is the case a caller has: a document whose rules change while it is on screen.
 */
test("applyFieldValidators replaces the rules on a live form", () => {
  const strict = { name: "age", kind: "number", validators: { min: 18 } };
  const relaxed = { name: "age", kind: "number" };
  const form = buildForm([strict], vanillaReactivity());

  form.f.age.set(10);
  assert.equal(form.f.age.valid(), false,
    "the document's rule is not on the form at all, so nothing below can tell whether a second "
    + "reading replaced it");

  applyFieldValidators(form, [relaxed]);
  form.f.age.set(10);
  assert.equal(form.f.age.valid(), true,
    "the relaxed reading was applied and the earlier rule still rejects the value: the rules "
    + "accumulate instead of replacing, so a document that loosens a bound never loosens on screen");

  applyFieldValidators(form, [strict]);
  form.f.age.set(10);
  assert.equal(form.f.age.valid(), false, "the rule cannot be put back once it has been taken off");

  form.deactivate();
});
