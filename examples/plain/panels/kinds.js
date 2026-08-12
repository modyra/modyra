/**
 * Every kind the catalogue declares, with the empty value its contract says it holds.
 *
 * Stated once and shared by the panels that need a form of everything. A table per panel is how a
 * daterange comes to be driven with `""` — true for a text field, a string where an object belongs
 * for a range, and the panel then shows a state the widget was never in.
 */
export const KINDS = [
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
  ["multiselect", [], { label: "Palette", options: OPTIONS() }],
  ["datepicker", null, { label: "Birthday" }],
  ["daterange", { start: null, end: null }, { label: "Stay" }],
  ["timepicker", null, { label: "Meeting" }],
  ["colors", "", { label: "Brand" }],
  ["file", [], { label: "CV" }],
];

/** Copies, because a field that mutates the shared table changes every other panel's options. */
function OPTIONS() {
  return [
    { value: "indigo", label: "Indigo" },
    { value: "cloud", label: "Cloud" },
    { value: "night", label: "Night" },
  ];
}
