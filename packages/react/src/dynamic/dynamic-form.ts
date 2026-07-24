/**
 * P13 "React dynamic renderer": runtime form construction from a
 * serializable Dynamic Form Contract v2 config — CMS, form builders,
 * low-code scenarios. Headless by design, matching every other hook this
 * package ships (@modyra/react has never shipped a rendered component;
 * consumers bring their own JSX — see docs/guides/headless-recipes.md).
 * "Parity" with Angular's `<mdy-dynamic-form>` means the same value/
 * validation/error semantics for the same Contract, not identical visual
 * output — this shares its scope and its one real limitation with that
 * component exactly: `fields` is a flat list (Contract `layout`/`rules`
 * are not applied here either, matching the Angular renderer's own
 * documented gap, not a new one).
 *
 * The schema-building and validator-wiring logic below is deliberately a
 * pair of plain functions, not inlined into the hook — this package has no
 * React-rendering test harness, so anything that needs real behavioral
 * verification (not just "the export exists") has to be callable directly
 * against a real form, the same way studio-preview's buildLiveForm is.
 */
import { useEffect, useMemo } from "react";
import {
  buildDynamicFieldValidators,
  createForm,
  field,
  type MdyCoreFormOptions,
  type MdyDynamicField,
  type MdyFormSchema,
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

/** Builds the (validator-free) schema for a flat field list — every field gets its real default value, no validators yet (those come from `applyDynamicValidators`, matching Angular's own two-step "base schema, then upsertValidators" approach). */
export function buildDynamicFormSchema(fields: ReadonlyArray<MdyDynamicField>): MdyFormSchema {
  const schema: Record<string, unknown> = {};
  for (const f of fields) schema[f.name] = field(defaultValueFor(f) as never, []);
  return schema as MdyFormSchema;
}

/** Applies each field's real Contract validators (via the same `buildDynamicFieldValidators` Angular's own dynamic form calls) onto an already-built form, keyed so re-applying replaces rather than accumulates. */
export function applyDynamicValidators(form: MdyTypedForm<MdyFormSchema>, fields: ReadonlyArray<MdyDynamicField>): void {
  for (const f of fields) {
    const { validators, marksRequired } = buildDynamicFieldValidators(f);
    form.upsertValidators(f.name, "mdy-dynamic", validators, marksRequired);
  }
}

export type UseMdyDynamicFormOptions = Omit<MdyCoreFormOptions<Record<string, unknown>>, "reactivity">;

/**
 * Builds a real, running form from a flat `MdyDynamicField[]` — the same
 * config shape `parseDynamicForm()` produces and Angular's
 * `<mdy-dynamic-form [fields]>` consumes. The schema (field *names*) is
 * fixed at first render, matching `useMdyForm`'s own "construct once"
 * contract; validators re-apply whenever `fields` changes (config-driven
 * apps commonly swap validator rules without remounting).
 */
export function useMdyDynamicForm(
  fields: ReadonlyArray<MdyDynamicField>,
  options?: UseMdyDynamicFormOptions,
): MdyTypedForm<MdyFormSchema> {
  const form = useMemo(
    () => createForm(buildDynamicFormSchema(fields), { ...options, autoActivate: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schema is intentionally built once, like useMdyForm's own schema thunk
    [],
  );

  useEffect(() => {
    applyDynamicValidators(form, fields);
  }, [fields, form]);

  useEffect(() => {
    form.activate();
    return () => form.deactivate();
  }, [form]);

  return form;
}
