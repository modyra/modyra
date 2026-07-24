/**
 * @modyra/plain — zero-dependency vanilla JS/HTML5 form renderer.
 *
 * Given a container element and a flat Dynamic Form Contract field list,
 * `mountMdyForm` builds a real @modyra/core form and renders real,
 * interactive DOM for every field, wired to @modyra/widgets' headless
 * controllers. No virtual DOM, no template engine, no framework runtime.
 */
export { mountMdyForm } from "./mount.js";
export type { MdyPlainForm, MountMdyFormOptions } from "./mount.js";

export { buildForm, buildFormSchema, applyFieldValidators } from "./schema.js";

export { renderField } from "./fields/index.js";
export { renderTextField } from "./fields/text-field.js";
export { renderBooleanField } from "./fields/boolean-field.js";
export { renderOptionField } from "./fields/option-field.js";
export { renderSelectField } from "./fields/select-field.js";
export { renderMultiselectField } from "./fields/multiselect-field.js";
export { renderDatepickerField } from "./fields/datepicker-field.js";
export { renderTimepickerField } from "./fields/timepicker-field.js";
