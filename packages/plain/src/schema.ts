/**
 * Builds and activates a real form from a flat Dynamic Form Contract field list.
 *
 * The schema and the validators are `@modyra/core`'s. The logic is pure engine — what a name may be,
 * what a kind holds when it holds nothing, how a flattened collection reads back as a list rather
 * than an object keyed "0" — and it had been written out again here under a name of its own.
 *
 * What belongs to this renderer is the last two lines: one reactivity graph shared with every field's
 * widget controller, and a form the caller owns.
 */
import {
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  type MdyDynamicCollection,
  type MdyDynamicField,
  type MdyFormSchema,
  type MdyReactivity,
  type MdyTypedForm,
} from "@modyra/core";

export { buildFlatFormSchema as buildFormSchema };

/** Applies the Contract validators, under this renderer's own key. */
export function applyFieldValidators(
  form: MdyTypedForm<MdyFormSchema>,
  fields: ReadonlyArray<MdyDynamicField>,
): void {
  applyFlatValidators(form, fields, "mdy-plain");
}

/** Builds and activates a real form from a flat field list, sharing one reactivity graph with every field's widget controller. Caller owns disposal via `form.deactivate()`. */
export function buildForm(
  fields: ReadonlyArray<MdyDynamicField>,
  reactivity: MdyReactivity,
  collections: ReadonlyArray<MdyDynamicCollection> = [],
): MdyTypedForm<MdyFormSchema> {
  const form = createForm(buildFlatFormSchema(fields, collections), { reactivity, autoActivate: false });
  applyFieldValidators(form, fields);
  form.activate();
  return form;
}
