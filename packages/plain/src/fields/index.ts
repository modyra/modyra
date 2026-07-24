/**
 * Picks the right renderer for a field's `kind` — the one place that knows
 * about every Dynamic Form Contract kind, mirroring the same `@switch`
 * Angular's `<mdy-dynamic-form>` template already does over `MdyDynamicField.kind`.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicField } from "@modyra/core";
import { renderBooleanField } from "./boolean-field.js";
import { renderDatepickerField } from "./datepicker-field.js";
import { renderMultiselectField } from "./multiselect-field.js";
import { renderOptionField } from "./option-field.js";
import { renderSelectField } from "./select-field.js";
import { renderTextField } from "./text-field.js";
import { renderTimepickerField } from "./timepicker-field.js";

export function renderField(
  container: HTMLElement,
  f: MdyDynamicField,
  handle: MdyFieldHandle<never>,
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  switch (f.kind) {
    case "text":
    case "textarea":
    case "email":
    case "password":
    case "number":
    case "slider":
      return renderTextField(container, f, handle as unknown as MdyFieldHandle<string | number>, reactivity);
    case "checkbox":
    case "toggle":
      return renderBooleanField(container, f, handle as unknown as MdyFieldHandle<boolean>, reactivity);
    case "radio":
    case "segmented":
      return renderOptionField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity);
    case "select":
      return renderSelectField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity);
    case "multiselect":
      return renderMultiselectField(container, f, handle as unknown as MdyFieldHandle<ReadonlyArray<unknown>>, reactivity, "single");
    case "datepicker":
      return renderDatepickerField(container, f, handle as unknown as MdyFieldHandle<string | null>, reactivity);
    case "timepicker":
      return renderTimepickerField(container, f, handle as unknown as MdyFieldHandle<string | null>, reactivity);
  }
}
