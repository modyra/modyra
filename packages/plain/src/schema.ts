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
import type { MdyDraftOptions } from "@modyra/core";
import {
  buildDynamicValidations,
  type MdyDynamicValidation,
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
  /**
   * What the form itself is asked to do beyond holding the fields — persistence, for now.
   *
   * Passed through rather than re-declared: a draft is the *form's* option, and this renderer's job
   * is to hand it over, not to have an opinion about it.
   */
  formOptions: {
    readonly draft?: string | MdyDraftOptions;
    /**
     * The document's cross-field rules, as `parseDynamicForm` reports them.
     *
     * A form built without them behaves as though the slot were empty: a document saying "start and
     * end must differ" produced a form that said so nowhere and submitted the pair anyway. They are
     * the form's own validators — one rule about two fields has no field to belong to.
     */
    readonly validations?: ReadonlyArray<MdyDynamicValidation>;
    /**
     * What a document cannot declare, supplied by the host that mounted it.
     *
     * A document says which rules a field has and *when* its asynchronous checks run — and has no
     * way to say that a field has any, because an async check is a function and a document is data.
     * A field verified against something only the server can reach therefore needs its check
     * attached here, by name.
     *
     * Merged onto the descriptor the document built rather than replacing it, so what the document
     * declared survives: a host adding a server check does not silently drop the rules the document
     * asked for.
     */
    readonly fieldOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  } = {},
): MdyTypedForm<MdyFormSchema> {
  const { validations = [], fieldOptions, ...forwarded } = formOptions;
  const schema = buildFlatFormSchema(fields, collections);
  if (fieldOptions) {
    for (const [name, extra] of Object.entries(fieldOptions)) {
      const descriptor = (schema as Record<string, unknown>)[name];
      if (descriptor === undefined) {
        // Named a field the document does not have: a check attached to nothing is a guarantee the
        // host believes is in force, which is worse than no check at all.
        throw new TypeError(
          `fieldOptions names "${name}", which this document does not declare. `
          + `It has: ${Object.keys(schema).join(", ")}`,
        );
      }
      (schema as Record<string, unknown>)[name] = { ...(descriptor as object), ...extra };
    }
  }
  const form = createForm(schema, {
    ...forwarded,
    validators: buildDynamicValidations(validations),
    reactivity,
    autoActivate: false,
  });
  applyFieldValidators(form, fields);
  form.activate();
  return form;
}
