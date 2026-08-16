/**
 * Static half of Plain's contract gate: the renderer must take its vocabulary and its behavior
 * from @modyra/widgets rather than restating them. The runtime half lives in
 * packages/plain/test/contract.test.mjs.
 */
import { readFileSync } from "node:fs";
import { MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";

const read = (path) => readFileSync(`packages/plain/src/${path}`, "utf8");
const failures = [];

// The anatomy this audit was written against. A bump means parts moved, so the audit is re-read
// rather than the number widened: accepting a range would make this line pass through exactly the
// change it exists to catch.
if (MDY_WIDGET_CONTRACT_VERSION !== 2) failures.push(`unsupported Widgets contract version: ${MDY_WIDGET_CONTRACT_VERSION}`);

const shell = read("field-shell.ts");
if (!shell.includes("MDY_WIDGET_CONTRACTS[kind]")) failures.push("field-shell.ts does not take its root classes from the widget definition");
if (!shell.includes("MDY_FIELD_SHELL_CLASSES")) failures.push("field-shell.ts does not take its shell classes from the contract");

// Every kind reaches a renderer, and every renderer gets its state from a widgets controller.
const registry = read("fields/index.ts");
const unregistered = MDY_WIDGET_KINDS.filter((kind) => !registry.includes(`case "${kind}"`));
if (unregistered.length) failures.push(`kinds with no renderer: ${unregistered.join(", ")}`);

const CONTROLLERS = {
  "fields/text-field.ts": "createTextFieldController",
  "fields/boolean-field.ts": "createBooleanFieldController",
  "fields/option-field.ts": "createOptionFieldController",
  "fields/select-field.ts": "createSelectController",
  "fields/multiselect-field.ts": "createMultiselectFieldController",
  "fields/datepicker-field.ts": "createDatepickerFieldController",
  "fields/timepicker-field.ts": "createTimepickerFieldController",
  // The kind's controller is the stronger claim than the transition it wraps: it owns the draft,
  // the preview and which cells fall between the ends.
  "fields/daterange-field.ts": "createDaterangeFieldController",
  "fields/file-field.ts": "fileSelectionTransition",
  "fields/colors-field.ts": "colorValueTransition",
};
for (const [file, controller] of Object.entries(CONTROLLERS)) {
  if (!read(file).includes(controller)) failures.push(`${file} does not consume ${controller}`);
}

// The generic vocabulary is not part of the contract, and must not reappear through the renderer.
for (const [file, source] of Object.entries({ "field-shell.ts": shell, "dom.ts": read("dom.ts") })) {
  for (const legacy of ["mdy-description", "mdy-error\"", "mdy-renderer--radio\""]) {
    if (source.includes(legacy)) failures.push(`${file} emits the non-canonical class ${legacy.replace(/"/g, "")}`);
  }
}

if (failures.length) {
  console.error("PLAIN WIDGET CONTRACT INCOMPLETE");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("PLAIN WIDGET CONTRACT COMPLETE");
console.log(`contractVersion: ${MDY_WIDGET_CONTRACT_VERSION}`);
console.log(`kinds: ${MDY_WIDGET_KINDS.length}`);
console.log(`controller families: ${Object.keys(CONTROLLERS).length}`);
