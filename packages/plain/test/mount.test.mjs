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
  // The label carries a `mdy-label__required` marker inside it, same as the Lit renderers,
  // so compare the label's own text rather than the whole subtree. A boolean control puts its
  // text in a span inside the clickable wrapper, so both shapes are searched.
  const ownText = (l) =>
    [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
  return [...container.querySelectorAll("label, .mdy-label, .mdy-toggle__label")].find((l) => ownText(l) === text);
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

  const listbox = document.getElementById(trigger.getAttribute("aria-controls"));
  assert.ok(listbox);
  assert.equal(selectWrapper.contains(listbox), false);
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

test("layout renders sections and column rows, and nests one inside the other", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const fields = [
    { name: "street", kind: "text", label: "Street" },
    { name: "city", kind: "text", label: "City" },
    { name: "zip", kind: "text", label: "ZIP" },
    { name: "notes", kind: "textarea", label: "Notes" },
  ];
  const handle = mountMdyForm(container, fields, {
    submitLabel: null,
    layout: [
      {
        kind: "section",
        id: "address",
        label: "Address",
        children: ["street", { kind: "columns", id: "cityZip", columns: [["city"], ["zip"]] }],
      },
    ],
  });

  const section = container.querySelector("fieldset.mdy-layout-section");
  assert.ok(section, "expected a section fieldset");
  assert.equal(section.dataset.layoutId, "address");
  assert.equal(section.querySelector("legend.mdy-layout-legend").textContent, "Address");

  const row = section.querySelector(".mdy-layout-columns");
  assert.ok(row, "expected the nested columns row inside the section");
  assert.equal(row.style.getPropertyValue("--mdy-layout-column-count"), "2");
  const columns = row.querySelectorAll(".mdy-layout-column");
  assert.equal(columns.length, 2);
  assert.ok(columns[0].querySelector("input"), "first column renders a real control");
  assert.ok(columns[1].querySelector("input"), "second column renders a real control");

  // A field the layout never mentions still renders, after the arranged part — never dropped.
  assert.ok(container.querySelector("textarea"), "unplaced field must still render");
  assert.equal(container.querySelectorAll("input, textarea").length, 4);

  handle.dispose();
  assert.equal(container.children.length, 0);
});

test("a field named twice by the layout renders once, not twice", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const handle = mountMdyForm(container, [{ name: "city", kind: "text", label: "City" }], {
    submitLabel: null,
    layout: [
      { kind: "section", id: "a", children: ["city"] },
      { kind: "section", id: "b", children: ["city"] },
    ],
  });

  // parseDynamicForm rejects this upstream, but mounting must not double-bind either.
  assert.equal(container.querySelectorAll("input").length, 1);
  handle.dispose();
});

test("a column row stays where its fields are, not hoisted to the top of the form", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const fields = [
    { name: "first", kind: "text", label: "First" },
    { name: "city", kind: "text", label: "City" },
    { name: "zip", kind: "text", label: "ZIP" },
    { name: "last", kind: "text", label: "Last" },
  ];
  const handle = mountMdyForm(container, fields, {
    submitLabel: null,
    layout: [{ kind: "columns", id: "cityZip", columns: [["city"], ["zip"]] }],
  });

  // first, [city | zip], last — the arranged pair must not jump ahead of "first".
  const order = Array.from(container.children).map((child) =>
    child.classList.contains("mdy-layout-columns") ? "row" : child.querySelector("input")?.id || "field",
  );
  assert.equal(order.length, 3);
  assert.equal(order[1], "row");
  assert.equal(container.querySelectorAll("input").length, 4);

  handle.dispose();
});


test("mount marks the host as a themed dynamic form and dispose restores it", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "name", kind: "text", label: "Name" }], { submitLabel: null });
  assert.equal(host.classList.contains("mdy-dynamic-form"), true);
  assert.equal(host.classList.contains("mdy-plain-form"), true);
  mounted.dispose();
  assert.equal(host.classList.contains("mdy-dynamic-form"), false);
  host.remove();
});

test("select listbox is portalled to document.body and removed on dispose", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "country", kind: "select", label: "Country", options: [{ value: "IT", label: "Italy" }] }], { submitLabel: null });
  const portals = document.body.querySelectorAll(".mdy-plain-select__portal");
  const listbox = portals[portals.length - 1];
  assert.ok(listbox);
  assert.equal(host.contains(listbox), false);
  mounted.dispose();
  assert.equal(listbox.isConnected, false);
  host.remove();
});

test("toggle preserves the widget input and adds a visual track and thumb", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "enabled", kind: "toggle", label: "Enabled" }], { submitLabel: null });
  // Same anatomy the Angular renderer emits, so the shipped themes style both identically.
  assert.ok(host.querySelector("label.mdy-toggle > input[type=checkbox]"));
  assert.ok(host.querySelector("label.mdy-toggle > .mdy-toggle__track > .mdy-toggle__thumb"));
  assert.ok(host.querySelector("label.mdy-toggle > .mdy-toggle__label"));
  mounted.dispose();
  host.remove();
});

test("daterange, file and colors mount and round-trip their own value shape", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [
    { name: "stay", kind: "daterange", label: "Stay" },
    { name: "cv", kind: "file", label: "CV", accept: ".pdf", multiple: true },
    { name: "brand", kind: "colors", label: "Brand" },
  ], { submitLabel: null });

  const [start, end] = [...host.querySelectorAll('.mdy-renderer--daterange input[type="date"]')];
  assert.ok(start && end, "a daterange owns two endpoints");
  start.value = "2026-07-01";
  start.dispatchEvent(new Event("change"));
  assert.deepEqual(mounted.form.f.stay.value(), { start: "2026-07-01", end: null });

  const file = host.querySelector('.mdy-renderer--file input[type="file"]');
  assert.equal(file.accept, ".pdf");
  assert.equal(file.multiple, true);
  assert.deepEqual(mounted.form.f.cv.value(), []);

  const color = host.querySelector('.mdy-renderer--colors input[type="color"]');
  color.value = "#7067ff";
  color.dispatchEvent(new Event("change"));
  assert.equal(mounted.form.f.brand.value(), "#7067ff");

  mounted.dispose();
  host.remove();
});
