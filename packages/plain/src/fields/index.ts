/**
 * Picks the right renderer for a field's `kind` — the one place that knows
 * about every Dynamic Form Contract kind, mirroring the same `@switch`
 * a declarative form template already does over `MdyDynamicField.kind`.
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicDateField, MdyDynamicDaterangeField, MdyDynamicField } from "@modyra/core";
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

/** The calendar presentation a date field declares, in the shape its renderer takes. */
function calendarOptionsOf(f: MdyDynamicDateField | MdyDynamicDaterangeField): {
  readonly minDate?: string | null;
  readonly maxDate?: string | null;
  readonly locale?: string;
  readonly firstDayOfWeek?: number;
} {
  return { minDate: f.minDate, maxDate: f.maxDate, locale: f.locale, firstDayOfWeek: f.firstDayOfWeek };
}

/**
 * @param reactivity The runtime the field observes on. Pass the form's own — `form.reactivity` —
 * whenever the host holds one. The default builds a fresh runtime, which is right for a field
 * rendered on its own and wrong for a field belonging to a form: two runtimes over one handle are
 * two schedulers with no ordering between them, and only one of them stops when the form does.
 *
 * @param widgetId The identity every generated id derives from. Defaults to the field name, which
 * is what a single form on a page wants; a host rendering two forms scopes it so the second form's
 * relationships do not resolve to the first form's elements.
 *
 * @returns The teardown, and it is not optional. It releases the effects this field subscribed;
 * a caller that drops it keeps them running against a form that may already be destroyed, and a
 * surviving effect renders nothing — so nothing in the document says it is still there.
 * `packages/plain/test/render-field-lifecycle.test.mjs` asserts this for every kind.
 */
export function renderField(
  container: HTMLElement,
  f: MdyDynamicField,
  handle: MdyFieldHandle<never>,
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
): () => void {
  reactivity = observerFor(handle, reactivity);
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
      return renderDatepickerField(container, f, handle as unknown as MdyFieldHandle<string | null>, reactivity, calendarOptionsOf(f), widgetId);
    case "daterange":
      return renderDaterangeField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, calendarOptionsOf(f), widgetId);
    case "file":
      return renderFileField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, widgetId);
    case "colors":
      return renderColorsField(container, f, handle as unknown as MdyFieldHandle<unknown>, reactivity, widgetId);
    case "timepicker":
      return renderTimepickerField(container, f, handle as unknown as MdyFieldHandle<string | null>, reactivity, undefined, widgetId);
  }
}
