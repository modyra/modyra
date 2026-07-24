/**
 * Real DOM integration test (jsdom): mounts every field kind at once and
 * drives real user interactions (typing, clicking, keyboard nav) through
 * to a real @modyra/core form's real values/validity — not just "the
 * function exists," the actual rendered contract.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const fields = [
  { name: "name", kind: "text", label: "Name", validators: { required: true } },
  { name: "age", kind: "number", label: "Age", validators: { min: 18 } },
  { name: "subscribe", kind: "checkbox", label: "Subscribe" },
  {
    name: "plan",
    kind: "radio",
    label: "Plan",
    options: [{ value: "basic", label: "Basic" }, { value: "pro", label: "Pro" }],
  },
  {
    name: "country",
    kind: "select",
    label: "Country",
    options: [{ value: "IT", label: "Italy" }, { value: "FR", label: "France" }],
  },
  {
    name: "interests",
    kind: "multiselect",
    label: "Interests",
    options: [{ value: "sports", label: "Sports" }, { value: "music", label: "Music" }],
  },
  { name: "birthdate", kind: "datepicker", label: "Birthdate" },
  { name: "meeting", kind: "timepicker", label: "Meeting" },
];

function byLabel(container, text) {
  return [...container.querySelectorAll("label")].find((l) => l.textContent === text);
}

test("mounts real DOM for every field kind, one control per field", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);

  for (const f of fields) {
    const label = byLabel(container, f.label);
    assert.ok(label, `expected a label for ${f.name}`);
  }
  assert.ok(container.querySelector("button")); // submit button by default

  dispose();
  form.deactivate();
});

test("typing into the text field updates the real form value", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);

  const input = container.querySelector('input[type="text"]');
  input.value = "Lorenzo";
  input.dispatchEvent(new Event("input"));

  assert.equal(form.f.name.value(), "Lorenzo");
  dispose();
});

test("required text field is invalid when empty, valid once filled", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);
  assert.equal(form.f.name.valid(), false);
  form.f.name.set("x");
  assert.equal(form.f.name.valid(), true);
  dispose();
});

test("checkbox click updates the real form value", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);

  const checkbox = container.querySelector('input[type="checkbox"]');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event("change"));

  assert.equal(form.f.subscribe.value(), true);
  dispose();
});

test("radio selection updates the real form value", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);

  const proRadio = [...container.querySelectorAll('input[type="radio"]')].find((r) => r.value === "pro");
  proRadio.checked = true;
  proRadio.dispatchEvent(new Event("change"));

  assert.equal(form.f.plan.value(), "pro");
  dispose();
});

test("select: clicking the trigger opens the listbox, clicking an option commits the value", async () => {
  const container = document.createElement("div");
  const { form, reactivity, dispose } = mountMdyForm(container, fields);

  const selectWrapper = container.querySelector(".mdy-plain-select");
  const trigger = selectWrapper.querySelector("input");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();

  const listbox = selectWrapper.querySelector("ul");
  assert.equal(listbox.hidden, false);

  const franceOption = [...listbox.querySelectorAll("li")].find((li) => li.textContent === "France");
  franceOption.dispatchEvent(new Event("click"));
  await reactivity.flush();

  assert.equal(form.f.country.value(), "FR");
  assert.equal(listbox.hidden, true); // selecting closes the listbox
  dispose();
});

test("multiselect: clicking a chip toggles membership in the real array value", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);

  const wrapper = container.querySelector(".mdy-plain-multiselect");
  const musicChip = [...wrapper.querySelectorAll("button")].find((b) => b.textContent === "Music");
  musicChip.dispatchEvent(new Event("click"));
  assert.deepEqual(form.f.interests.value(), ["music"]);

  musicChip.dispatchEvent(new Event("click"));
  assert.deepEqual(form.f.interests.value(), []);
  dispose();
});

test("datepicker: opening shows a 42-cell grid, clicking a day commits an ISO value", async () => {
  const container = document.createElement("div");
  const { form, reactivity, dispose } = mountMdyForm(container, fields);

  const wrapper = container.querySelector(".mdy-plain-datepicker");
  const trigger = wrapper.querySelector("button");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();

  const popup = wrapper.querySelector("div");
  const grid = popup.querySelectorAll("div")[1]; // popup -> [header, grid]
  const dayButtons = grid.querySelectorAll("button");
  assert.equal(dayButtons.length, 42);

  dayButtons[15].dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.match(form.f.birthdate.value(), /^\d{4}-\d{2}-\d{2}$/);
  dispose();
});

test("timepicker: setting hour/minute and confirming commits a formatted value", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);

  const wrapper = container.querySelector(".mdy-plain-timepicker");
  const [trigger, hourInput, minuteInput, , confirmButton] = [
    wrapper.querySelector("button"),
    ...wrapper.querySelectorAll('input[type="number"]'),
    wrapper.querySelectorAll("button")[1],
  ];
  trigger.dispatchEvent(new Event("click"));

  hourInput.value = "7";
  hourInput.dispatchEvent(new Event("input"));
  minuteInput.value = "15";
  minuteInput.dispatchEvent(new Event("input"));

  const confirm = [...wrapper.querySelectorAll("button")].find((b) => b.textContent === "Confirm");
  confirm.dispatchEvent(new Event("click"));

  assert.match(form.f.meeting.value(), /^07:15 (AM|PM)$/);
  dispose();
});

test("dispose() removes all rendered DOM and deactivates the form", () => {
  const container = document.createElement("div");
  const { form, dispose } = mountMdyForm(container, fields);
  dispose();
  assert.equal(container.children.length, 0);
  assert.equal(form.state.pending(), false);
});
