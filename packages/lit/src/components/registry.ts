import { MdyCheckboxFieldElement } from "./checkbox-field.js";
import { MdyColorsFieldElement } from "./colors-field.js";
import { MdyDatepickerFieldElement } from "./datepicker-field.js";
import { MdyDaterangeFieldElement } from "./daterange-field.js";
import { MdyFileFieldElement } from "./file-field.js";
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
];

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
