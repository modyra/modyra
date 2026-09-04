/**
 * The catalogue scenario: one field of every kind the vocabulary declares.
 *
 * Declared once and read by every demo, so the framework-free, Vue, Lit and Angular pages show the
 * same seventeen controls holding the same values — they differ in how a form is mounted, not in
 * what a form is. It is the same argument `legend.js` makes for the words above a panel, made for
 * the fields below them.
 *
 * **A showcase, and it says so.** There is no story here: nobody fills in a colour, a date range and
 * a file upload to accomplish one thing. The scenarios beside this one carry the stories; this one
 * carries the coverage, and pretending otherwise would mean forcing a colour picker into a checkout
 * to fill a box — the opposite of an example worth reading.
 *
 * **The list of kinds is not written here.** `MDY_FIELD_KINDS` is the one place a kind is declared,
 * and a copy would show sixteen the day a seventeenth arrived. What is written here is what each
 * kind starts from and how it is labelled, and a kind with neither is refused at import rather than
 * quietly left out of the page.
 */
import { MDY_FIELD_KINDS } from "@modyra/core";

/** What each kind starts from, and how a page labels it. */
const PRESENTATION = {
  text: { initial: "", label: "Text" },
  email: { initial: "", label: "Email" },
  password: { initial: "", label: "Password" },
  textarea: { initial: "", label: "Bio" },
  number: { initial: null, label: "Age" },
  slider: { initial: 0, label: "Volume" },
  checkbox: { initial: false, label: "Accept" },
  // On, not off, and that is the point of the value: a switch only shows its "on" treatment when it
  // is on, so a page that draws it off shows half of what a theme paints.
  toggle: { initial: true, label: "Newsletter" },
  radio: { initial: null, label: "Plan", options: () => THREE() },
  segmented: { initial: null, label: "Mode", options: () => THREE() },
  select: { initial: null, label: "Country", options: () => THREE() },
  // The one field that holds a dozen: the strip's cost, and the screen-reader walk, are both
  // questions about length rather than about the control working at all.
  multiselect: {
    initial: () => A_DOZEN().map((option) => option.value),
    label: "Palette",
    options: () => A_DOZEN(),
    // Reorderable, because the chips a person can drag are a different control from the chips they
    // cannot, and the one worth showing is the one with more to go wrong.
    reorderable: true,
  },
  datepicker: { initial: null, label: "Birthday" },
  daterange: { initial: () => ({ start: null, end: null }), label: "Stay" },
  timepicker: { initial: null, label: "Meeting" },
  colors: { initial: "", label: "Brand" },
  file: { initial: () => [], label: "CV" },
};

/**
 * Copies, not the same array twice.
 *
 * A field that reorders or edits its options would otherwise change every other page built from this
 * declaration — one scenario's mutation arriving in another's controls, which reads as a bug in
 * whichever page is looked at second.
 */
const called = (value) => (typeof value === "function" ? value() : value);

function THREE() {
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
 * answer at a length somebody could give up on.
 */
function A_DOZEN() {
  return [
    { value: "indigo", label: "Indigo" }, { value: "cloud", label: "Cloud" },
    { value: "night", label: "Night" }, { value: "sienna", label: "Sienna" },
    { value: "harbour", label: "Harbour" }, { value: "moss", label: "Moss" },
    { value: "cobalt", label: "Cobalt" }, { value: "amber", label: "Amber" },
    { value: "slate", label: "Slate" }, { value: "coral", label: "Coral" },
    { value: "juniper", label: "Juniper" }, { value: "saffron", label: "Saffron" },
  ];
}

/** The fields, in the order the vocabulary declares its kinds. */
export function everyKindFields() {
  return MDY_FIELD_KINDS.map((kind) => {
    const declared = PRESENTATION[kind];
    // Refused here rather than drawn short: a page missing one control looks finished, and the kind
    // that arrived without a presentation is exactly the one nobody would notice was absent.
    if (!declared) throw new Error(`[scenarios] no presentation declared for kind "${kind}"`);
    return {
      name: kind,
      kind,
      label: declared.label,
      initial: called(declared.initial),
      ...(declared.options ? { options: called(declared.options) } : {}),
      ...(declared.reorderable ? { reorderable: true } : {}),
    };
  });
}

/** A showcase, declared as one. */
export const everyKind = {
  name: "everyKind",
  title: "Every kind the catalogue declares",
  genre: "catalogue",
  fields: everyKindFields,
};
