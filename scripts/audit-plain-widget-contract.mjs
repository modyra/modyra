/**
 * Static half of Plain's contract gate: the renderer must take its vocabulary and its behavior
 * from @modyra/widgets rather than restating them. The runtime half lives in
 * packages/plain/test/contract.test.mjs.
 */
import { readFileSync } from "node:fs";
import { MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";

/**
 * Source with its comments removed.
 *
 * Every question below is `does this file contain this name`, and a name written in a doc block
 * answers yes while the renderer does nothing of the kind. That is the whole failure mode of a
 * presence check: prose satisfies it, silently, and the gate reports a renderer as consuming a
 * controller it only mentions. The checks that read the other way — a class that must *not* appear —
 * gain the same thing from the other side, since a class named in a comment is not emitted.
 */
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const read = (path) => strip(readFileSync(`packages/plain/src/${path}`, "utf8"));
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
  "fields/select-field.ts": "createSelectFieldController",
  "fields/multiselect-field.ts": "createMultiselectFieldController",
  "fields/datepicker-field.ts": "createDatepickerFieldController",
  "fields/timepicker-field.ts": "createTimepickerFieldController",
  // The kind's controller is the stronger claim than the transition it wraps: it owns the draft,
  // the preview and which cells fall between the ends. Three rows here named a transition or an
  // older factory instead, and each of those names survived in a doc block after the renderer had
  // moved on — so the row went on passing against a claim that had stopped being true.
  "fields/daterange-field.ts": "createDaterangeFieldController",
  "fields/file-field.ts": "createFileFieldController",
  "fields/colors-field.ts": "createColorsFieldController",
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
console.log("Read from source with its comments removed: which names each renderer's code contains,\n  never what it renders — a mention would answer a presence check that no behaviour backs.");
