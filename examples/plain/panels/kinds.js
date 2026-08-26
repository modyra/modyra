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
  // On, not off, and that is the point of the value: a switch only shows its "on" treatment when it
  // is on, so a baseline that photographs it off is a baseline that cannot see half of what a theme
  // paints. One did exactly that, and a defect that made an on switch look unavailable crossed it
  // untouched.
  ["toggle", true, { label: "Newsletter" }],
  ["radio", null, { label: "Plan", options: OPTIONS() }],
  ["segmented", null, { label: "Mode", options: OPTIONS() }],
  ["select", null, { label: "Country", options: OPTIONS() }],
  // The one field that holds a dozen: the strip's cost, and the screen-reader walk, are both
  // questions about length rather than about the control working at all.
  ["multiselect", A_DOZEN().map((option) => option.value),
    { label: "Palette", options: A_DOZEN(), reorderable: true }],
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

/**
 * A dozen, for the field where the length of the walk is the thing being looked at.
 *
 * Three is enough to see that a strip works and not enough to see what it costs. Crossing a chosen
 * value with the arrows is two presses at three and twelve at twelve, and the question a person with
 * a screen reader is answering — *is this reachable, or do I give up before the end* — only has an
 * answer at a length somebody could give up on. A short version of the walk is not a short version
 * of the question.
 *
 * Ordinary names rather than one-syllable ones, because how long a value takes to hear is part of
 * what is being measured.
 */
function A_DOZEN() {
  return [
    { value: "indigo", label: "Indigo" },
    { value: "cloud", label: "Cloud" },
    { value: "night", label: "Night" },
    { value: "sienna", label: "Sienna" },
    { value: "harbour", label: "Harbour" },
    { value: "moss", label: "Moss" },
    { value: "cobalt", label: "Cobalt" },
    { value: "amber", label: "Amber" },
    { value: "slate", label: "Slate" },
    { value: "coral", label: "Coral" },
    { value: "juniper", label: "Juniper" },
    { value: "saffron", label: "Saffron" },
  ];
}
