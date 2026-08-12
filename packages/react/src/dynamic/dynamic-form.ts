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
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  type MdyCoreFormOptions,
  type MdyDynamicField,
  type MdyFormSchema,
  type MdyTypedForm,
} from "@modyra/core";

/**
 * The schema and the validators are `@modyra/core`'s.
 *
 * Both were written here, again in the framework-free renderer under a different name, and inlined a
 * third time — while a *fourth* function called `buildDynamicFormSchema` in core took a nested node
 * and did something else. The logic is pure engine: what a name may be, what a kind holds when it
 * holds nothing, how a flattened collection reads back as a list rather than an object keyed "0".
 *
 * Re-exported under the names this package has always published, so a consumer's import keeps
 * working. The core version also rebuilds collections, which this one never could.
 */
export {
  buildFlatFormSchema as buildDynamicFormSchema,
} from "@modyra/core";

/** Applies the Contract validators, under this binding's own key. */
export function applyDynamicValidators(
  form: MdyTypedForm<MdyFormSchema>,
  fields: ReadonlyArray<MdyDynamicField>,
): void {
  applyFlatValidators(form, fields, "mdy-dynamic");
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
    () => createForm(buildFlatFormSchema(fields), { ...options, autoActivate: false }),
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
