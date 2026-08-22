/**
 * Every kind the catalogue declares, with the empty value its contract says it holds.
 *
 * Stated once and shared by the panels that need a form of everything. A table per panel is how a
 * daterange comes to be driven with `""` — true for a text field, a string where an object belongs
 * for a range, and the panel then shows a state the widget was never in.
 */
import { MDY_FIELD_KINDS } from "@modyra/core";

/** What each kind starts from, and how this page labels it. */
const PRESENTATION = Object.fromEntries([
  ["text", "", { label: "Text" }],
  ["email", "", { label: "Email" }],
  ["password", "", { label: "Password" }],
  ["textarea", "", { label: "Bio" }],
  ["number", null, { label: "Age" }],
  ["slider", 0, { label: "Volume" }],
  ["checkbox", false, { label: "Accept" }],
  ["toggle", false, { label: "Newsletter" }],
  ["radio", null, { label: "Plan", options: OPTIONS() }],
  ["segmented", null, { label: "Mode", options: OPTIONS() }],
  ["select", null, { label: "Country", options: OPTIONS() }],
  ["multiselect", [], { label: "Palette", options: OPTIONS(), reorderable: true }],
  ["datepicker", null, { label: "Birthday" }],
  ["daterange", { start: null, end: null }, { label: "Stay" }],
  ["timepicker", null, { label: "Meeting" }],
  ["colors", "", { label: "Brand" }],
  ["file", [], { label: "CV" }],
].map(([kind, empty, extra]) => [kind, [empty, extra]]));

/**
 * The kinds, in the order the vocabulary declares them, with what each starts from and how it is
 * labelled. The list of kinds is not written here: `MDY_FIELD_KINDS` is the one place a kind is
 * declared, and a panel that kept its own copy would show sixteen the day a seventeenth arrived.
 */
export const KINDS = MDY_FIELD_KINDS.map((kind) => {
  const entry = PRESENTATION[kind];
  if (!entry) throw new Error(`[lab] no presentation declared for kind "${kind}"`);
  return [kind, entry[0], entry[1]];
});


/** Copies, because a field that mutates the shared table changes every other panel's options. */
function OPTIONS() {
  return [
    { value: "indigo", label: "Indigo" },
    { value: "cloud", label: "Cloud" },
    { value: "night", label: "Night" },
  ];
}
