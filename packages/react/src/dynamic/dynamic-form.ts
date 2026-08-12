/**
 * "React dynamic renderer": runtime form construction from a
 * serializable Dynamic Form Contract v2 config — CMS, form builders,
 * low-code scenarios. Headless by design, matching every other hook this
 * package ships (@modyra/react has never shipped a rendered component;
 * consumers bring their own JSX — see docs/guides/headless-recipes.md).
 * Parity across renderers means the same value, validation and error semantics for the same
 * Contract, not identical visual output. The scope and the one real limitation are the contract's,
 * not this binding's: `fields` is a flat list, and Contract `layout` is not
 * applied — because there is nothing here to apply it to.
 *
 * That is not a gap this package is waiting to close. It renders no elements
 * at all, so an arrangement has nothing to arrange. A consumer who wants one
 * applies it to their own JSX with `layoutNodeAttributes` and `layoutSlotStyle`
 * from `@modyra/widgets` — framework-free, and the same two functions every
 * rendering adapter calls, so the grid is theirs to place but not theirs to
 * invent.
 *
 * The schema-building and validator-wiring logic below is deliberately a
 * pair of plain functions, not inlined into the hook — this package has no
 * React-rendering test harness, so anything that needs real behavioral
 * verification (not just "the export exists") has to be callable directly
 * against a real form, the same way studio-preview's buildLiveForm is.
 */
import { useEffect, useMemo } from "react";
import {
  assertSafeDynamicFieldNames,
  buildDynamicFieldValidators,
  createForm,
  field,
  mdyEmptyValueFor,
  type MdyCoreFormOptions,
  type MdyDynamicField,
  type MdyFormSchema,
  type MdyTypedForm,
} from "@modyra/core";

/**
 * Builds the validator-free schema for a flat field list: every field gets its default value and no
 * rules. Rules arrive separately through `applyDynamicValidators`, because a document that changes
 * must be able to replace them without rebuilding the form the user is typing into.
 */
export function buildDynamicFormSchema(fields: ReadonlyArray<MdyDynamicField>): MdyFormSchema {
  // The names become the schema's keys and the empty values its initial state. Both rules are core's:
  // it decides what a key may be and what a kind holds when it holds nothing, so a form built here
  // starts where the same field starts under any other adapter. A local table would drift — and a
  // number starting at 0 rather than null is a field `required` can never fail.
  assertSafeDynamicFieldNames(fields);
  const schema: Record<string, unknown> = {};
  for (const f of fields) schema[f.name] = field(mdyEmptyValueFor(f) as never, []);
  return schema as MdyFormSchema;
}

/**
 * Applies each field's Contract validators onto an already-built form, through the core's own
 * `buildDynamicFieldValidators`. Keyed, so re-applying replaces rather than accumulates — a document
 * edited twice must not leave the first edition's rules behind.
 */
export function applyDynamicValidators(form: MdyTypedForm<MdyFormSchema>, fields: ReadonlyArray<MdyDynamicField>): void {
  for (const f of fields) {
    const { validators, marksRequired } = buildDynamicFieldValidators(f);
    form.upsertValidators(f.name, "mdy-dynamic", validators, marksRequired);
  }
}

export type UseMdyDynamicFormOptions = Omit<MdyCoreFormOptions<Record<string, unknown>>, "reactivity">;

/**
 * Builds a real, running form from a flat `MdyDynamicField[]` — the same
 * config shape `parseDynamicForm()` produces and every renderer consumes. The schema (field
 * *names*) is
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
