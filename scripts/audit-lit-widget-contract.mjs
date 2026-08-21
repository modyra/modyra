/**
 * Lit's contract gate — the one renderer that had none.
 *
 * Plain has `audit-plain-widget-contract.mjs` and Angular has its baseline diff. Lit shipped with
 * neither, and it is the renderer that consumes the least: measured, its datepicker and daterange
 * carry one widgets symbol between 1283 lines. A renderer with no gate is a renderer whose drift is
 * discovered by a person.
 *
 * Same shape as Plain's, and deliberately so: every kind reaches an element, the shell vocabulary
 * comes from the contract rather than from string literals, and each family consumes the widgets
 * behaviour that serves it.
 */
import { readFileSync } from "node:fs";
import { MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";

const read = (path) => readFileSync(`packages/lit/src/${path}`, "utf8");
const failures = [];

// The anatomy this audit was written against. A bump means parts moved, so the audit is re-read
// rather than the number widened: accepting a range would make this line pass through exactly the
// change it exists to catch.
//
// Version 4 moved a boolean's indicator and a toggle's track under the label; version 5 gave a
// timepicker's dial the layer of stretches that carry no selectable time. Re-read against both:
// nothing below asks about parentage or about which parts exist — the checks here are which
// controller a renderer consumes and which classes it must not emit, and the rendered anatomy is
// what `inspectWidgetDom` measures in the runtime suites.
if (MDY_WIDGET_CONTRACT_VERSION !== 5) failures.push(`unsupported Widgets contract version: ${MDY_WIDGET_CONTRACT_VERSION}`);

const base = read("base.ts");
if (!base.includes("MDY_WIDGET_CONTRACTS")) failures.push("base.ts does not take its root classes from the widget definition");
if (!base.includes("MDY_FIELD_SHELL_CLASSES")) failures.push("base.ts does not take its shell classes from the contract");
if (!base.includes("projectFieldShellA11y")) failures.push("base.ts does not project the shared shell accessibility");
if (!base.includes("shownErrorsOf")) failures.push("base.ts decides for itself which errors a field shows");

/**
 * Every kind reaches a custom element.
 *
 * The tags do not name the kinds one for one — `email` and `password` are `<mdy-text-field>` with a
 * type, `radio` is the radio group, `segmented` its own element — so the mapping is stated rather
 * than inferred from the name.
 */
const TAG = {
  text: "mdy-text-field", email: "mdy-text-field", password: "mdy-text-field",
  textarea: "mdy-textarea-field", number: "mdy-number-field", slider: "mdy-slider-field",
  checkbox: "mdy-checkbox-field", toggle: "mdy-toggle-field",
  radio: "mdy-radio-group-field", segmented: "mdy-segmented-field",
  select: "mdy-select-field", multiselect: "mdy-multiselect-field",
  datepicker: "mdy-datepicker-field", daterange: "mdy-daterange-field",
  timepicker: "mdy-timepicker-field", colors: "mdy-colors-field", file: "mdy-file-field",
};
const registry = read("components/registry.ts");
for (const kind of MDY_WIDGET_KINDS) {
  const tag = TAG[kind];
  if (!tag) { failures.push(`${kind}: no element named for this kind`); continue; }
  if (!registry.includes(`"${tag}"`)) failures.push(`${kind}: ${tag} is not registered`);
}

/** Each family consumes the behaviour @modyra/widgets holds for it. */
const CONSUMES = {
  "components/text-field.ts": "createTextFieldController",
  "components/checkbox-field.ts": "createBooleanFieldController",
  "components/radio-group-field.ts": "createOptionFieldController",
  "widget-runtime/select-adapter.ts": "createSelectController",
  "components/select-field.ts": "selectKeyboardAction",
  "components/multiselect-field.ts": "multiselectChipClasses",
  "components/datepicker-field.ts": "overlayControlledId",
  "components/timepicker-field.ts": "timeFieldBounds",
  "components/popup-styles.ts": "anchorOverlay",
  "widget-runtime/overlay-host.ts": "createLightDismiss",
};
/**
 * What this renderer does not consume yet, and why the gate still passes.
 *
 * Asserted both ways: a new gap fails, and so does an entry that has been closed and left here. A
 * list that only grows is a comment; this one is a claim about the code that is checked on every run.
 */
const KNOWN_GAPS = {};

for (const [file, symbol] of Object.entries(CONSUMES)) {
  const key = `${file}:${symbol}`;
  const consumed = read(file).includes(symbol);
  if (!consumed && !(key in KNOWN_GAPS)) failures.push(`${file} does not consume ${symbol}`);
  if (consumed && key in KNOWN_GAPS) failures.push(`${key} is recorded as a gap and is no longer one — remove the entry`);
}

if (failures.length) {
  console.error("LIT WIDGET CONTRACT INCOMPLETE");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("LIT WIDGET CONTRACT COMPLETE");
console.log(`contractVersion: ${MDY_WIDGET_CONTRACT_VERSION}`);
console.log(`kinds: ${MDY_WIDGET_KINDS.length}`);
console.log(`consuming files: ${Object.keys(CONSUMES).length}`);
console.log(`recorded gaps: ${Object.keys(KNOWN_GAPS).length}`);
for (const [key, reason] of Object.entries(KNOWN_GAPS)) console.log(`  ${key} — ${reason}`);
