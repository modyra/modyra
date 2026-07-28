// Full-catalog demo for the framework-free renderer: every one of the seventeen widget kinds,
// every packaged theme, and the live contract verdict for what is on screen.
//
// The conformance banner runs `inspectWidgetDom` from `@modyra/widgets/testing` against the real
// rendered DOM, so this page is not only a look-at-it demo: it is the same gate CI runs, visible
// while you switch themes and interact with the controls.
import { mountMdyForm } from "@modyra/plain";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { inspectWidgetDom } from "@modyra/widgets/testing";

const THEMES = {
  modern: "modyra-modern.css",
  default: "modyra.css",
  material: "modyra-material.css",
  ios: "modyra-ios.css",
  ionic: "modyra-ionic.css",
  "tokens only": "modyra-base.css",
};

const colors = [
  { value: "indigo", label: "Indigo" },
  { value: "cloud", label: "Cloud" },
  { value: "night", label: "Night" },
];
const FIELDS = [
  { name: "name", kind: "text", label: "Full name", validators: { required: true }, description: "As printed on the document." },
  { name: "email", kind: "email", label: "Email", validators: { required: true, email: true } },
  { name: "password", kind: "password", label: "Password", validators: { minLength: 8 } },
  { name: "bio", kind: "textarea", label: "Bio", placeholder: "A line or two" },
  { name: "age", kind: "number", label: "Age", validators: { min: 18, max: 120 } },
  { name: "volume", kind: "slider", label: "Volume" },
  { name: "terms", kind: "checkbox", label: "I accept the terms", validators: { required: true } },
  { name: "newsletter", kind: "toggle", label: "Send me the newsletter" },
  { name: "plan", kind: "radio", label: "Plan", options: [{ value: "basic", label: "Basic" }, { value: "pro", label: "Pro" }] },
  { name: "billing", kind: "segmented", label: "Billing", options: [{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }] },
  { name: "country", kind: "select", label: "Country", options: [{ value: "it", label: "Italy" }, { value: "fr", label: "France" }, { value: "de", label: "Germany" }] },
  { name: "palette", kind: "multiselect", label: "Palette", options: colors },
  { name: "birthday", kind: "datepicker", label: "Birthday" },
  { name: "stay", kind: "daterange", label: "Stay" },
  { name: "meeting", kind: "timepicker", label: "Meeting" },
  { name: "cv", kind: "file", label: "CV", accept: ".pdf,.doc", multiple: true },
  { name: "brand", kind: "colors", label: "Brand colour" },
];

const formHost = document.querySelector("[data-form]");
const statePre = document.querySelector("[data-state]");
const banner = document.querySelector("#conformance");
const themeBar = document.querySelector("[data-themes]");

let current = "modern";
for (const [name, file] of Object.entries(THEMES)) {
  const button = document.createElement("button");
  button.type = "button";
  button.append(Object.assign(document.createElement("span"), { textContent: name }));
  button.setAttribute("aria-pressed", String(name === current));
  button.addEventListener("click", () => {
    current = name;
    document.getElementById("theme").href = `./themes/${file}`;
    for (const other of themeBar.children) other.setAttribute("aria-pressed", String(other === button));
  });
  themeBar.append(button);
}

const mounted = mountMdyForm(formHost, FIELDS, {
  submitLabel: "Submit",
  onSubmit: (value) => { statePre.textContent = `submitted\n\n${JSON.stringify(value, null, 2)}`; },
});

/**
 * Reports the contract verdict for what is on screen. The part lookup is by canonical class,
 * which is the point: if a renderer invented its own name, the part simply is not found and the
 * banner says so.
 */
const PART_SELECTORS = {
  label: ".mdy-label, .mdy-toggle__label",
  requiredMarker: ".mdy-label__required",
  inputWrapper: ".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle",
  control: "input, textarea, select",
  track: ".mdy-toggle__track, .mdy-input-wrapper",
  thumb: ".mdy-toggle__thumb",
  group: ".mdy-radio-group, .mdy-segmented",
  option: ".mdy-plain-option-row",
  trigger: ".mdy-select__trigger, .mdy-plain-multiselect",
  arrow: ".mdy-select__arrow",
  chips: ".mdy-multiselect",
  chip: ".mdy-multiselect__chip",
  toggle: ".mdy-datepicker__toggle, .mdy-timepicker__toggle",
  popup: ".mdy-datepicker__popup, .mdy-timepicker__popup",
  grid: ".mdy-datepicker__grid",
  gridcell: ".mdy-datepicker__cell",
  hour: ".mdy-timepicker__hour",
  minute: ".mdy-timepicker__minute",
  startControl: 'input[type="date"]',
  dropzone: ".mdy-input-wrapper",
  supportingText: ".mdy-supporting-text",
  errors: ".mdy-control__errors",
  errorItem: ".mdy-control__error",
};

function report() {
  const rows = [];
  for (const field of FIELDS) {
    const root = formHost.querySelector(`[data-mdy-field="${field.name}"]`);
    if (!root) continue;
    const parts = {};
    for (const node of MDY_WIDGET_CONTRACTS[field.kind].structure.nodes) {
      const selector = PART_SELECTORS[node.part];
      if (selector) parts[node.part] = root.querySelector(selector);
    }
    if (field.kind === "daterange") parts.endControl = root.querySelectorAll('input[type="date"]')[1];
    if (field.kind === "datepicker" || field.kind === "timepicker") parts.control = root.querySelector(`.mdy-${field.kind}__input`);
    const missing = MDY_WIDGET_CONTRACTS[field.kind].structure.nodes
      .filter((node) => node.part !== "root" && !parts[node.part])
      .map((node) => node.part);
    const issues = inspectWidgetDom(root, field.kind, { parts, absentParts: missing });
    if (issues.length) rows.push(`${field.kind}: ${issues.map((issue) => `${issue.code} [${issue.part}]`).join(", ")}`);
  }
  banner.className = rows.length ? "fail" : "pass";
  banner.textContent = rows.length
    ? `Contract violations in the rendered DOM:\n${rows.join("\n")}`
    : `All ${FIELDS.length} kinds conform to the widget DOM contract.`;
}

function dumpState() {
  const value = mounted.form.value();
  statePre.textContent = JSON.stringify(value, null, 2);
}

formHost.addEventListener("input", () => { dumpState(); report(); });
formHost.addEventListener("change", () => { dumpState(); report(); });
dumpState();
report();
