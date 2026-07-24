/**
 * Builds a real, running @modyra/core form from a flat Dynamic Form
 * Contract field list — the same logic packages/react/src/dynamic/
 * dynamic-form.ts's buildDynamicFormSchema/applyDynamicValidators use,
 * reimplemented here rather than imported: that file's module also pulls
 * in "react" at the top, which would force a real React dependency onto
 * this zero-dependency package for no functional reason (the logic itself
 * is plain @modyra/core, nothing React-specific).
 */
import {
  buildDynamicFieldValidators,
  createForm,
  field,
  type MdyDynamicField,
  type MdyFormSchema,
  type MdyReactivity,
  type MdyTypedForm,
} from "@modyra/core";

function defaultValueFor(f: MdyDynamicField): unknown {
  if (f.initialValue !== undefined) return f.initialValue;
  switch (f.kind) {
    case "number":
    case "slider":
      return 0;
    case "checkbox":
    case "toggle":
      return false;
    case "multiselect":
      return [];
    default:
      return f.kind === "select" || f.kind === "radio" || f.kind === "segmented" || f.kind === "datepicker" || f.kind === "timepicker" ? null : "";
  }
}

/** Builds the (validator-free) schema for a flat field list — every field gets its real default value; validators come from {@link applyDynamicFieldValidators}. */
export function buildFormSchema(fields: ReadonlyArray<MdyDynamicField>): MdyFormSchema {
  const schema: Record<string, unknown> = {};
  for (const f of fields) schema[f.name] = field(defaultValueFor(f) as never, []);
  return schema as MdyFormSchema;
}

/** Applies each field's real Contract validators onto an already-built form, keyed so re-applying replaces rather than accumulates. */
export function applyFieldValidators(form: MdyTypedForm<MdyFormSchema>, fields: ReadonlyArray<MdyDynamicField>): void {
  for (const f of fields) {
    const { validators, marksRequired } = buildDynamicFieldValidators(f);
    form.upsertValidators(f.name, "mdy-plain", validators, marksRequired);
  }
}

/** Builds and activates a real form from a flat field list, sharing one reactivity graph with every field's widget controller. Caller owns disposal via `form.deactivate()`. */
export function buildForm(fields: ReadonlyArray<MdyDynamicField>, reactivity: MdyReactivity): MdyTypedForm<MdyFormSchema> {
  const form = createForm(buildFormSchema(fields), { reactivity, autoActivate: false });
  applyFieldValidators(form, fields);
  form.activate();
  return form;
}
