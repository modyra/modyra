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
// The words a control shows are the contract's, so a test names the key rather than the English.
const { MDY_I18N_MESSAGES_DEFAULT: MSG } = await import("@modyra/widgets");

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
  // The label carries a `mdy-label__required` marker inside it, as the contract's label anatomy declarers,
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

  const selectWrapper = container.querySelector(".mdy-select");
  const trigger = selectWrapper.querySelector(".mdy-select__trigger");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();

  const listbox = document.getElementById(trigger.getAttribute("aria-controls"));
  const popup = listbox.closest(".mdy-select__dropdown");
  assert.ok(listbox);
  assert.equal(selectWrapper.contains(popup), false, "the popup is portalled out of the field");
  assert.equal(popup.hidden, false);
  // Filtering happens in the popup's own field, not over the trigger's text.
  // A listbox has no filter box. The combobox model is asserted by the searchable test below.
  assert.equal(popup.querySelector(".mdy-select__search"), null);

  const franceOption = [...listbox.querySelectorAll("li")].find((li) => li.textContent === "France");
  franceOption.dispatchEvent(new Event("click"));
  await reactivity.flush();

  assert.equal(form.f.country.value(), "FR");
  assert.equal(popup.hidden, true); // selecting closes the popup
  // The value and the placeholder are two parts; the committed one is the visible one.
  assert.equal(selectWrapper.querySelector(".mdy-select__value").textContent, "France");
  assert.equal(selectWrapper.querySelector(".mdy-select__placeholder").hidden, true);
  dispose();
});

test("multiselect: the field shows the options as chips, and the search button opens the same grid", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const { form, reactivity, dispose } = mountMdyForm(container, fields);

  const trigger = container.querySelector(".mdy-multiselect__search-btn");
  const popup = document.getElementById(trigger.getAttribute("aria-controls"));
  // Closed by default and portalled out of the field, so opening it cannot reflow the form.
  assert.equal(popup.hidden, true);
  assert.equal(container.contains(popup), false);

  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.equal(popup.hidden, false);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");

  // The field carries its own grid of the same chips, so the options are visible without opening
  // anything — the popup is the filter, not the only way in.
  const fieldGrid = container.querySelector(".mdy-multiselect__options:not(.mdy-multiselect-overlay__grid)");
  assert.equal(fieldGrid.querySelectorAll(".mdy-chip").length, popup.querySelectorAll(".mdy-chip").length);

  const musicChip = [...popup.querySelectorAll(".mdy-chip--centered")].find((b) => b.textContent.startsWith("Music"));
  musicChip.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.deepEqual(form.f.interests.value(), ["music"]);
  // Picking keeps the popup open: a multiselect exists to take more than one choice.
  assert.equal(popup.hidden, false);
  // Both grids mark it taken: one option, one state, wherever its chip is drawn.
  const takenIn = (root) => [...root.querySelectorAll(".mdy-chip--selected")].map((chip) => chip.textContent);
  assert.deepEqual(takenIn(fieldGrid), ["Music"]);
  assert.deepEqual(takenIn(popup), ["Music"]);

  musicChip.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.deepEqual(form.f.interests.value(), []);
  assert.deepEqual(takenIn(fieldGrid), []);
  dispose();
  container.remove();
});

test("datepicker: opening shows a 42-cell grid, clicking a day commits an ISO value", async () => {
  const container = document.createElement("div");
  const { form, reactivity, dispose } = mountMdyForm(container, fields);

  const wrapper = container.querySelector(".mdy-plain-datepicker");
  const trigger = wrapper.querySelector("button");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();

  const popup = wrapper.querySelector(".mdy-datepicker__popup");
  const dayButtons = popup.querySelectorAll(".mdy-datepicker__cell");
  assert.equal(dayButtons.length, 42);
  // Six week rows plus the weekday header, as the contract's calendar anatomy requires.
  assert.equal(popup.querySelectorAll(".mdy-datepicker__row").length, 6);
  assert.equal(popup.querySelectorAll(".mdy-datepicker__weekday").length, 7);

  dayButtons[15].dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.match(form.f.birthdate.value(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(popup.hidden, true, "picking a day closes the calendar");
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

  const confirm = [...wrapper.querySelectorAll("button")].find((b) => b.textContent === MSG.timepickerConfirm);
  confirm.dispatchEvent(new Event("click"));

  // The value is canonical `HH:mm`, which is what the value contract declares a time is; the
  // notation on screen is the control's own, and a twelve-hour picker shows the meridiem.
  assert.match(form.f.meeting.value(), /^(07|19):15$/);
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
  // Mobile-first: the row stacks at the narrowest size and takes its declared tracks from `sm` up.
  assert.equal(row.style.getPropertyValue("--mdy-layout-column-count"), "1");
  assert.equal(row.style.getPropertyValue("--mdy-layout-column-count-sm"), "2");
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

test("a section in a column is one column, holding all its fields", async () => {
  // This is how a group joins a row: Studio compiles a container slot to a section, so the cell
  // holds one child and the group keeps its box, rather than its fields spilling loose into the row.
  const container = document.createElement("div");
  document.body.append(container);
  const fields = [
    { name: "country", kind: "text", label: "Country" },
    { name: "shipping.city", kind: "text", label: "City" },
    { name: "shipping.zip", kind: "text", label: "ZIP" },
  ];
  const handle = mountMdyForm(container, fields, {
    submitLabel: null,
    layout: [
      {
        kind: "columns",
        id: "row",
        columns: [
          ["country"],
          [{ kind: "section", id: "shipping", label: "Shipping address", children: ["shipping.city", "shipping.zip"] }],
        ],
      },
    ],
  });

  const columns = container.querySelectorAll(".mdy-layout-columns > .mdy-layout-column");
  assert.equal(columns.length, 2, "the group takes one column, not one per field");
  assert.equal(columns[0].querySelectorAll("input").length, 1);

  const nested = columns[1].querySelector("fieldset.mdy-layout-section");
  assert.ok(nested, "the group renders as a section inside its column");
  assert.equal(nested.dataset.layoutId, "shipping");
  assert.equal(nested.querySelector("legend.mdy-layout-legend").textContent, "Shipping address");
  assert.equal(nested.querySelectorAll("input").length, 2, "both of the group's fields render inside it");
  assert.equal(container.querySelectorAll("input").length, 3, "and nothing renders twice");

  handle.dispose();
});

test("a v3 slot renders its field and places its column", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const handle = mountMdyForm(container, [
    { name: "a", kind: "text", label: "A" },
    { name: "b", kind: "text", label: "B" },
  ], {
    submitLabel: null,
    layout: [{
      kind: "columns",
      id: "row",
      columns: [
        [{ ref: "a", at: { base: { hidden: true }, md: { hidden: false } } }],
        [{ ref: "b", at: { md: { column: 1 } } }],
      ],
    }],
  });

  const cells = container.querySelectorAll(".mdy-layout-column");
  assert.equal(cells.length, 2);
  // A slot names a field the same way a bare string does — it just also says where it goes.
  assert.equal(cells[0].querySelectorAll("input").length, 1);
  assert.equal(cells[1].querySelectorAll("input").length, 1);

  assert.equal(cells[0].style.getPropertyValue("--mdy-layout-column-display"), "none");
  assert.equal(cells[0].style.getPropertyValue("--mdy-layout-column-display-md"), "flex");
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-start-md"), "1");
  // Nothing was said about `sm`, so nothing is written and the cascade falls back.
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-start-sm"), "");

  handle.dispose();
});

test("a section in a column is placed like any other column", async () => {
  // How a group in a row is laid out for a screen size: the section occupies the column, so the
  // column is what carries the placement — the same element, read the same way, as for a slot.
  const container = document.createElement("div");
  document.body.append(container);
  const handle = mountMdyForm(container, [
    { name: "country", kind: "text", label: "Country" },
    { name: "shipping.city", kind: "text", label: "City" },
  ], {
    submitLabel: null,
    layout: [{
      kind: "columns",
      id: "row",
      columns: [
        ["country"],
        [{ kind: "section", id: "shipping", label: "Shipping", children: ["shipping.city"], at: { base: { hidden: true }, md: { hidden: false } } }],
      ],
    }],
  });

  const cells = container.querySelectorAll(".mdy-layout-column");
  assert.equal(cells.length, 2);
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-display"), "none");
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-display-md"), "flex");
  // The section still renders, with its fields — hidden is a size's decision, not a deletion.
  assert.ok(cells[1].querySelector("fieldset.mdy-layout-section"));
  assert.equal(cells[1].querySelectorAll("input").length, 1);

  handle.dispose();
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

  // first, [city | zip], last — the arranged pair must not jump ahead of "first". The form's own
  // error region sits before all of them and is not part of what a layout arranges.
  const arranged = Array.from(container.children).filter(
    (child) => !child.classList.contains("mdy-form__errors"),
  );
  const order = arranged.map((child) =>
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
  const portals = document.body.querySelectorAll(".mdy-select__dropdown.mdy-overlay");
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
  // The anatomy the catalogue declares, so the shipped themes style both identically.
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

  const [start, end] = [...host.querySelectorAll(".mdy-renderer--daterange .mdy-daterange__input")];
  assert.ok(start && end, "a daterange owns two endpoints");
  assert.ok(host.querySelector(".mdy-renderer--daterange .mdy-daterange__sep"), "and a separator between them");
  // A typed end is kept as it is typed. The calendar's draft policy — nothing commits until the
  // second click — is about picking: there the first click is half a gesture, while a person who
  // typed a start and stopped has said something, and erasing it leaves two empty boxes and no way
  // to learn what happened.
  start.value = "2026-07-01";
  start.dispatchEvent(new Event("change"));
  assert.deepEqual(mounted.form.f.stay.value(), { start: "2026-07-01", end: null });
  end.value = "2026-07-08";
  end.dispatchEvent(new Event("change"));
  assert.deepEqual(mounted.form.f.stay.value(), { start: "2026-07-01", end: "2026-07-08" });

  const file = host.querySelector(".mdy-renderer--file .mdy-file-input");
  assert.equal(file.accept, ".pdf");
  assert.equal(file.multiple, true);
  assert.deepEqual(mounted.form.f.cv.value(), []);
  assert.ok(host.querySelector(".mdy-file-container > .mdy-file-content .mdy-file-list"));

  const color = host.querySelector(".mdy-renderer--colors .mdy-colors__native-hidden");
  color.value = "#7067ff";
  color.dispatchEvent(new Event("input"));
  assert.equal(mounted.form.f.brand.value(), "#7067ff");

  mounted.dispose();
  host.remove();
});

test("daterange: the calendar picks a range and only a complete one commits", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { form, reactivity, dispose } = mountMdyForm(host, [{ name: "stay", kind: "daterange", label: "Stay" }], { submitLabel: null });

  const wrapper = host.querySelector(".mdy-plain-daterange");
  wrapper.querySelector(".mdy-datepicker__toggle").dispatchEvent(new Event("click"));
  await reactivity.flush();

  const popup = wrapper.querySelector(".mdy-datepicker__popup");
  assert.equal(popup.hidden, false);
  const days = [...popup.querySelectorAll(".mdy-datepicker__cell")];
  assert.equal(days.length, 42);

  days[10].dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.deepEqual(form.f.stay.value(), { start: null, end: null }, "half a range commits nothing");

  days[14].dispatchEvent(new Event("click"));
  await reactivity.flush();
  // The days between the endpoints carry the in-range state the themes draw.
  assert.ok(days[12].classList.contains("mdy-datepicker__cell--in-range"));
  assert.ok(days[10].classList.contains("mdy-datepicker__cell--range-start"));
  assert.ok(days[14].classList.contains("mdy-datepicker__cell--range-end"));

  // Completing the range answers what the calendar was opened to ask: it commits and closes.
  const value = form.f.stay.value();
  assert.match(value.start, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(value.end > value.start);
  assert.equal(popup.hidden, true);

  dispose();
  host.remove();
});

test("file: the widget policy accepts what matches and rejects what does not", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { form, reactivity, dispose } = mountMdyForm(host, [
    { name: "cv", kind: "file", label: "CV", accept: ".pdf", multiple: true },
  ], { submitLabel: null });

  const input = host.querySelector(".mdy-file-input");
  const pdf = new File(["x"], "cv.pdf", { type: "application/pdf" });
  const png = new File(["x"], "photo.png", { type: "image/png" });
  // jsdom's FileList is read-only, so the picked set is handed over the same way a browser does.
  Object.defineProperty(input, "files", { value: [pdf, png], configurable: true });
  input.dispatchEvent(new Event("change"));
  await reactivity.flush();

  assert.deepEqual(form.f.cv.value().map((f) => f.name), ["cv.pdf"], "the accept tokens filter the drop");
  const items = host.querySelectorAll(".mdy-file-item");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /cv\.pdf/);

  host.querySelector(".mdy-file-clear").dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.deepEqual(form.f.cv.value(), []);
  assert.equal(host.querySelectorAll(".mdy-file-item").length, 0);

  dispose();
  host.remove();
});

test("colors: a preset commits and closes the popup, a hex value commits and does not", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { form, reactivity, dispose } = mountMdyForm(host, [
    { name: "brand", kind: "colors", label: "Brand", presets: ["#7067ff", "#22c55e"] },
  ], { submitLabel: null });

  const popup = host.querySelector(".mdy-colors__dropdown");
  const toggle = host.querySelector(".mdy-colors__toggle-area");
  assert.equal(popup.hidden, true);
  toggle.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.equal(popup.hidden, false);

  const [, green] = host.querySelectorAll(".mdy-color-swatch");
  green.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.equal(form.f.brand.value(), "#22c55e");
  assert.equal(popup.hidden, true, "picking a preset closes the popup");
  assert.equal(green.getAttribute("aria-selected"), "true");

  // A hex value the policy rejects leaves the committed colour alone.
  const hex = host.querySelector(".mdy-colors__hex-input");
  hex.value = "nope";
  hex.dispatchEvent(new Event("change"));
  await reactivity.flush();
  assert.equal(form.f.brand.value(), "#22c55e");

  toggle.dispatchEvent(new Event("click"));
  hex.value = "#0e0f16";
  hex.dispatchEvent(new Event("change"));
  await reactivity.flush();
  assert.equal(form.f.brand.value(), "#0e0f16");
  assert.equal(popup.hidden, false, "typing a hex value is not an answer to the palette");

  dispose();
  host.remove();
});

test("a committed value is shown by the control that opened the overlay", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { form, reactivity, dispose } = mountMdyForm(host, [
    { name: "birthdate", kind: "datepicker", label: "Birthdate" },
    { name: "country", kind: "select", label: "Country", options: [{ value: "IT", label: "Italy" }, { value: "FR", label: "France" }] },
  ], { submitLabel: null });

  // Committing restores focus to the trigger, so a focus-guarded sync used to skip these two.
  const dateInput = host.querySelector(".mdy-datepicker__input");
  host.querySelector(".mdy-datepicker__toggle").dispatchEvent(new Event("click"));
  await reactivity.flush();
  const day = [...host.querySelectorAll(".mdy-datepicker__cell")].find((c) => !c.classList.contains("mdy-datepicker__cell--outside"));
  day.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.equal(dateInput.value, form.f.birthdate.value());
  assert.notEqual(dateInput.value, "");

  const trigger = host.querySelector(".mdy-select__trigger");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();
  const listbox = document.getElementById(trigger.getAttribute("aria-controls"));
  [...listbox.querySelectorAll("li")].find((li) => li.textContent === "France").dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.equal(host.querySelector(".mdy-select__value").textContent, "France");

  dispose();
  host.remove();
});

test("multiselect toggles membership rather than accumulating duplicates", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { form, reactivity, dispose } = mountMdyForm(host, [
    { name: "palette", kind: "multiselect", label: "Palette", options: [{ value: "indigo", label: "Indigo" }, { value: "cloud", label: "Cloud" }] },
  ], { submitLabel: null });

  const trigger = host.querySelector(".mdy-multiselect__search-btn");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();
  const chip = document.getElementById(trigger.getAttribute("aria-controls")).querySelector(".mdy-chip--centered");
  for (let click = 0; click < 3; click += 1) chip.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.deepEqual(form.f.palette.value(), ["indigo"]);

  chip.dispatchEvent(new Event("click"));
  await reactivity.flush();
  assert.deepEqual(form.f.palette.value(), []);

  dispose();
  host.remove();
});

test("filtering hides the options that do not match, in the select and the multiselect", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose } = mountMdyForm(host, [
    // Filtering is the combobox model, and the contract now says which model a select is.
    { name: "country", kind: "select", label: "Country", searchable: true, options: [{ value: "it", label: "Italy" }, { value: "fr", label: "France" }, { value: "de", label: "Germany" }] },
    { name: "palette", kind: "multiselect", label: "Palette", options: [{ value: "indigo", label: "Indigo" }, { value: "cloud", label: "Cloud" }] },
  ], { submitLabel: null });

  const trigger = host.querySelector(".mdy-select__trigger");
  trigger.dispatchEvent(new Event("click"));
  await reactivity.flush();
  const popup = document.getElementById(trigger.getAttribute("aria-controls")).closest(".mdy-select__dropdown");
  const search = popup.querySelector(".mdy-select__search");
  search.value = "ran";
  search.dispatchEvent(new Event("input"));
  await reactivity.flush();

  const shown = [...popup.querySelectorAll(".mdy-select__option")].filter((li) => !li.hidden);
  assert.deepEqual(shown.map((li) => li.textContent), ["France"]);

  const msTrigger = host.querySelector(".mdy-multiselect__search-btn");
  msTrigger.dispatchEvent(new Event("click"));
  await reactivity.flush();
  const msPopup = document.getElementById(msTrigger.getAttribute("aria-controls"));
  const filter = msPopup.querySelector(".mdy-multiselect-overlay__input");
  filter.value = "clo";
  filter.dispatchEvent(new Event("input"));
  await reactivity.flush();
  const chips = [...msPopup.querySelectorAll(".mdy-chip--centered")].filter((chip) => !chip.hidden);
  assert.deepEqual(chips.map((chip) => chip.textContent), ["Cloud"]);

  dispose();
  host.remove();
});

test("a pointer outside an open overlay dismisses it, in every widget that owns one", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose } = mountMdyForm(host, [
    { name: "country", kind: "select", label: "Country", options: [{ value: "it", label: "Italy" }] },
    { name: "birthdate", kind: "datepicker", label: "Birthdate" },
    { name: "stay", kind: "daterange", label: "Stay" },
    { name: "meeting", kind: "timepicker", label: "Meeting" },
    { name: "brand", kind: "colors", label: "Brand" },
    { name: "palette", kind: "multiselect", label: "Palette", options: [{ value: "indigo", label: "Indigo" }] },
  ], { submitLabel: null });

  const outside = document.createElement("button");
  document.body.append(outside);
  // The event the contract names, not one this suite picks. It dispatched `pointerdown` while that
  // was this renderer's own choice; the capability carries the event now, so a renderer that binds
  // something else fails here rather than only in a browser.
  const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");
  const dismissal = MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnOutsidePointer;
  assert.equal(dismissal, "light-dismiss");
  // `light-dismiss` is an interaction with an origin and a completion, so both are driven. A single
  // event would pass on a renderer that dismissed on the press alone — the behaviour this stops.
  const fire = (target, type, opts = {}) => target.dispatchEvent(
    Object.assign(new window.Event(type, { bubbles: true }), opts),
  );
  const press = (target, opts = {}) =>
    fire(target, "pointerdown", { pointerId: 1, isPrimary: true, button: 0, ...opts });
  const away = () => { press(outside); fire(outside, "click"); };

  const openers = [
    // Resolved through aria-controls: several suites portal a select popup into this same body.
    [".mdy-select__trigger", () => document.getElementById(host.querySelector(".mdy-select__trigger").getAttribute("aria-controls")).closest(".mdy-select__dropdown")],
    [".mdy-datepicker__toggle", () => host.querySelector(".mdy-plain-datepicker .mdy-datepicker__popup")],
    [".mdy-plain-daterange .mdy-datepicker__toggle", () => host.querySelector(".mdy-plain-daterange .mdy-datepicker__popup")],
    [".mdy-timepicker__toggle", () => host.querySelector(".mdy-timepicker__popup")],
    [".mdy-colors__toggle-area", () => host.querySelector(".mdy-colors__dropdown")],
    [".mdy-multiselect__search-btn", () => document.getElementById(host.querySelector(".mdy-multiselect__search-btn").getAttribute("aria-controls"))],
  ];
  for (const [opener, popupOf] of openers) {
    host.querySelector(opener).dispatchEvent(new Event("click"));
    await reactivity.flush();
    assert.equal(popupOf().hidden, false, `${opener} did not open`);

    // An interaction the browser cancelled to scroll is not a dismissal.
    press(outside);
    fire(outside, "pointercancel", { pointerId: 1 });
    fire(outside, "click");
    await reactivity.flush();
    assert.equal(popupOf().hidden, false, `${opener} dismissed on a cancelled pointer`);

    // Neither is a secondary button.
    press(outside, { button: 2 });
    fire(outside, "click");
    await reactivity.flush();
    assert.equal(popupOf().hidden, false, `${opener} dismissed on a non-primary button`);

    away();
    await reactivity.flush();
    assert.equal(popupOf().hidden, true, `${opener} stayed open after an interaction outside`);
  }

  outside.remove();
  dispose();
  host.remove();
});

test("contract v2 layout renders the canonical grid vocabulary", async () => {
  const { MDY_LAYOUT_CLASSES, MDY_LAYOUT_COLUMN_COUNT_PROPERTY } = await import("../../widgets/dist/index.js");
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [
    { name: "first", kind: "text", label: "First" },
    { name: "last", kind: "text", label: "Last" },
    { name: "notes", kind: "textarea", label: "Notes" },
  ], {
    submitLabel: null,
    layout: [
      {
        kind: "section",
        id: "identity",
        label: "Identity",
        children: [{ kind: "columns", id: "name-row", columns: [["first"], ["last"]] }, "notes"],
      },
    ],
  });

  const section = host.querySelector(`.${MDY_LAYOUT_CLASSES.section}`);
  assert.ok(section, "the section is rendered with the contract's class");
  assert.equal(section.dataset.layoutId, "identity");
  assert.equal(section.querySelector(`.${MDY_LAYOUT_CLASSES.sectionLabel}`).textContent, "Identity");

  const row = section.querySelector(`.${MDY_LAYOUT_CLASSES.columns}`);
  assert.ok(row, "the column row is rendered with the contract's class");
  // The count is what the foundation divides the row by; a wrong one silently misdraws the grid.
  assert.equal(row.style.getPropertyValue(MDY_LAYOUT_COLUMN_COUNT_PROPERTY), "1");
  assert.equal(row.style.getPropertyValue(`${MDY_LAYOUT_COLUMN_COUNT_PROPERTY}-sm`), "2");
  assert.equal(row.querySelectorAll(`.${MDY_LAYOUT_CLASSES.column}`).length, 2);

  // Fields land where the layout put them, and one the layout does not mention still renders.
  const [firstColumn, lastColumn] = row.querySelectorAll(`.${MDY_LAYOUT_CLASSES.column}`);
  assert.ok(firstColumn.querySelector('[data-mdy-field="first"]'));
  assert.ok(lastColumn.querySelector('[data-mdy-field="last"]'));
  assert.ok(section.querySelector('[data-mdy-field="notes"]'));

  mounted.dispose();
  host.remove();
});

test("a field's declared locale reaches its calendar", async () => {
  // Without this the renderer has nothing to consult but `navigator.language` — the visitor's
  // preference, not the form's. A booking form for an Italian office shows an Italian calendar to
  // a visitor whose browser is in English, and only the form knows that.
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "when", kind: "datepicker", label: "When", locale: "it-IT" }], { submitLabel: null });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const weekdays = [...host.querySelectorAll(".mdy-datepicker__weekday")].map((node) => node.textContent.trim());
  assert.deepEqual(weekdays, ["L", "M", "M", "G", "V", "S", "D"]);
  // And the browser's own locale is genuinely different, or this asserts nothing.
  assert.notEqual(navigator.language, "it-IT");

  mounted.dispose();
  host.remove();
});
