/**
 * Picks the right renderer for a field's `kind` — the one place that knows
 * about every Dynamic Form Contract kind, mirroring the same `@switch`
 * a declarative form template already does over `MdyDynamicField.kind`.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicField } from "@modyra/core";
import { renderDaterangeField } from "./daterange-field.js";
import { renderColorsField } from "./colors-field.js";
import { renderFileField } from "./file-field.js";
import { renderBooleanField } from "./boolean-field.js";
import { renderDatepickerField } from "./datepicker-field.js";
import { renderMultiselectField } from "./multiselect-field.js";
import { renderOptionField } from "./option-field.js";
import { renderSelectField } from "./select-field.js";
import { renderTextField } from "./text-field.js";
import { renderTimepickerField } from "./timepicker-field.js";

/**
 * @param widgetId The identity every generated id derives from. Defaults to the field name, which
 * is what a single form on a page wants; a host rendering two forms scopes it so the second form's
 * relationships do not resolve to the first form's elements.
 */
export function renderField(
  container: HTMLElement,
  f: MdyDynamicField,
  handle: MdyFieldHandle<never>,
  reactivity: MdyReactivity = vanillaReactivity(),
  widgetId: string = f.name,
): () => void {
  switch (f.kind) {
    case "text":
    case "textarea":
    case "email":
    case "password":
    case "number":
    case "slider":
      return renderTextField(container, f, handle as unknown as MdyFieldHandle<string | number>, reactivity, widgetId);
    case "checkbox":
    case "toggle":
      return renderBooleanField(container, f, handle as unknown as MdyFieldHandle<boolean>, reactivity, widgetId);
    case "radio":
    case "segmented":
      return renderOptionField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, widgetId);
    case "select":
      return renderSelectField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, widgetId);
    case "multiselect":
      return renderMultiselectField(container, f, handle as unknown as MdyFieldHandle<ReadonlyArray<unknown>>, reactivity, f.mode ?? "single", widgetId);
    case "datepicker":
      return renderDatepickerField(container, f, handle as unknown as MdyFieldHandle<string | null>, reactivity, undefined, widgetId);
    case "daterange":
      return renderDaterangeField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, undefined, widgetId);
    case "file":
      return renderFileField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, widgetId);
    case "colors":
      return renderColorsField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, widgetId);
    case "timepicker":
      return renderTimepickerField(container, f, handle as unknown as MdyFieldHandle<string | null>, reactivity, undefined, widgetId);
  }
}
