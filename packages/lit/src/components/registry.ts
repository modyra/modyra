import { MdyCheckboxFieldElement } from "./checkbox-field.js";
import { MdyColorsFieldElement } from "./colors-field.js";
import { MdyDatepickerFieldElement } from "./datepicker-field.js";
import { MdyDaterangeFieldElement } from "./daterange-field.js";
import { MdyFileFieldElement } from "./file-field.js";
import { MdyFormErrorsElement } from "./form-errors.js";
import { MdyMultiselectFieldElement } from "./multiselect-field.js";
import { MdyNumberFieldElement } from "./number-field.js";
import { MdyRadioGroupFieldElement } from "./radio-group-field.js";
import { MdySegmentedFieldElement } from "./segmented-field.js";
import { MdySelectFieldElement } from "./select-field.js";
import { MdySliderFieldElement } from "./slider-field.js";
import { MdyTextFieldElement } from "./text-field.js";
import { MdyTextareaFieldElement } from "./textarea-field.js";
import { MdyTimepickerFieldElement } from "./timepicker-field.js";
import { MdyToggleFieldElement } from "./toggle-field.js";

// ─── Registration ────────────────────────────────────────────────────────────

const CATALOG: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  ["mdy-text-field", MdyTextFieldElement],
  ["mdy-textarea-field", MdyTextareaFieldElement],
  ["mdy-number-field", MdyNumberFieldElement],
  ["mdy-checkbox-field", MdyCheckboxFieldElement],
  ["mdy-toggle-field", MdyToggleFieldElement],
  ["mdy-radio-group-field", MdyRadioGroupFieldElement],
  ["mdy-segmented-field", MdySegmentedFieldElement],
  ["mdy-select-field", MdySelectFieldElement],
  ["mdy-multiselect-field", MdyMultiselectFieldElement],
  ["mdy-slider-field", MdySliderFieldElement],
  ["mdy-datepicker-field", MdyDatepickerFieldElement],
  ["mdy-daterange-field", MdyDaterangeFieldElement],
  ["mdy-timepicker-field", MdyTimepickerFieldElement],
  ["mdy-colors-field", MdyColorsFieldElement],
  ["mdy-file-field", MdyFileFieldElement],
  // Not a field: it speaks for the form, and a host places it where the form's own refusals belong.
  ["mdy-form-errors", MdyFormErrorsElement],
];

/**
 * The element that draws a kind, or `null` for a kind this package does not draw.
 *
 * Published because a host otherwise keeps its own copy of this map, and a copy needs a fallback for
 * the kind it does not find. The fallback every copy reaches for is a text field, and a text field is
 * what `kind: "passwordd"` — one letter more than a real kind — then renders as: the value on screen,
 * no error, and a page that looks finished.
 *
 * `null` is the answer that lets a host refuse instead of guessing. A kind this package does not draw
 * is not a kind to draw as something else.
 *
 * Three kinds share one element and say which they are through `type`, the way a consumer writing
 * lit by hand does: `<mdy-text-field type="email">`.
 */
// A null prototype, because these keys are data: a document declaring `kind: "__proto__"` reads
// `Object.prototype` off a plain object, which is not `null` and is not an element either — so the
// guard below would pass it on as a tag name.
const TAG_FOR_KIND: Readonly<Record<string, string>> = Object.freeze(Object.assign(Object.create(null) as Record<string, string>, {
  text: "mdy-text-field", email: "mdy-text-field", password: "mdy-text-field",
  textarea: "mdy-textarea-field",
  number: "mdy-number-field",
  slider: "mdy-slider-field",
  checkbox: "mdy-checkbox-field",
  toggle: "mdy-toggle-field",
  radio: "mdy-radio-group-field",
  segmented: "mdy-segmented-field",
  select: "mdy-select-field",
  multiselect: "mdy-multiselect-field",
  datepicker: "mdy-datepicker-field",
  daterange: "mdy-daterange-field",
  timepicker: "mdy-timepicker-field",
  file: "mdy-file-field",
  colors: "mdy-colors-field",
}));

/** The custom element that draws one kind, or `null` where this package draws none. */
export function mdyLitTagFor(kind: string): string | null {
  return TAG_FOR_KIND[kind] ?? null;
}

/** Registers the whole control catalog (idempotent). */
export function defineMdyElements(): void {
  for (const [tag, ctor] of CATALOG) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
}

/** Registers `<mdy-text-field>` only (idempotent). */
export function defineMdyTextField(): void {
  if (!customElements.get("mdy-text-field")) {
    customElements.define("mdy-text-field", MdyTextFieldElement);
  }
}
