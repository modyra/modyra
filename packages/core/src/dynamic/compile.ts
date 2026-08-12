/**
 * Turning a document into the engine's own vocabulary.
 *
 * The document is already trusted by the time it reaches here: `./parse.ts` decides what a
 * document is allowed to say, and this decides what the engine is asked to do about it.
 */

import { array, field, group, record, type MdyFormSchema } from "../typed-form.js";
import type { MdyFormValidatorFn, ValidatorFn } from "../types.js";
import { evaluateExpression, expressionPaths } from "../expression.js";
import {
  eachOneOf,
  email,
  completeRange,
  max,
  maxLength,
  min,
  minLength,
  crossField,
  oneOf,
  pattern,
  required,
  valueShape,
} from "../validators.js";

import { MDY_MAX_DYNAMIC_PATTERN_LENGTH, warnDev } from "./guards.js";
import {
  mdyEmptyValueFor,
  type MdyDynamicField,
  type MdyDynamicGroupNode,
  type MdyDynamicNode,
  type MdyDynamicValidators,
} from "./schema.js";
import type { MdyDynamicValidation } from "./parse.js";

/**
 * Maps the serializable validator set to validator functions.
 * Returns the functions plus whether the set marks the field required.
 */
export function buildDynamicValidators(config: MdyDynamicValidators): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  const out: Array<ValidatorFn<never>> = [];
  if (config.required) out.push(required());
  if (config.email) out.push(email() as ValidatorFn<never>);
  if (config.min !== undefined) out.push(min(config.min) as ValidatorFn<never>);
  if (config.max !== undefined) out.push(max(config.max) as ValidatorFn<never>);
  if (config.minLength !== undefined) {
    out.push(minLength(config.minLength) as ValidatorFn<never>);
  }
  if (config.maxLength !== undefined) {
    out.push(maxLength(config.maxLength) as ValidatorFn<never>);
  }
  if (config.pattern !== undefined) {
    if (config.pattern.length > MDY_MAX_DYNAMIC_PATTERN_LENGTH) {
      warnDev(
        `Skipped dynamic pattern validator: pattern length ${config.pattern.length} exceeds max ${MDY_MAX_DYNAMIC_PATTERN_LENGTH}.`,
      );
    } else {
      try {
        out.push(pattern(new RegExp(config.pattern)) as ValidatorFn<never>);
      } catch {
        warnDev(
          `Skipped dynamic pattern validator: invalid RegExp source "${config.pattern}".`,
        );
      }
    }
  }
  return { validators: out, marksRequired: config.required === true };
}

/**
 * Builds the full validator set for one dynamic field: the configured
 * validators ({@link buildDynamicValidators}) plus, for option-based
 * kinds, an automatic whitelist of the declared option values — the
 * client-side anti-tampering guard ("select offers one/two → three is
 * invalid"). `select`/`radio`/`segmented` get `oneOf`, `multiselect` gets
 * `eachOneOf`. Prefer this over {@link buildDynamicValidators} whenever
 * the whole field config is available.
 */
export function buildDynamicFieldValidators(field: MdyDynamicField): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  const declared = buildDynamicValidators(field.validators ?? {});
  // Every kind guards its own shape, the same doorway `oneOf` guards for the kinds that have an
  // option list: a value from a restored draft or a scripted write is not the widget's own.
  const base = {
    ...declared,
    validators: [...declared.validators, valueShape(field.kind) as ValidatorFn<never>],
  };
  if (
    field.kind === "select" ||
    field.kind === "radio" ||
    field.kind === "segmented"
  ) {
    const values = field.options.map((option) => option.value);
    return {
      validators: [...base.validators, oneOf(values) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  if (field.kind === "multiselect") {
    const values = field.options.map((option) => option.value);
    return {
      validators: [...base.validators, eachOneOf(values) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  // A half-set range names no interval, so it is invalid whether or not the field is required —
  // the same way an option outside the declared set is invalid above. Leaving it to `required`
  // would mean an optional range could be submitted with a start and no end.
  if (field.kind === "daterange") {
    return {
      validators: [...base.validators, completeRange() as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  return base;
}

/**
 * Builds a form schema from the contract's **tree**, keeping its groups and arrays.
 *
 * {@link flattenDynamicSchema} answers a different question. It produces one flat list of dotted
 * names for a renderer that draws a sequence of controls, and in doing so it fixes each array at the
 * rows its initial value happened to have — which is correct for drawing and wrong for running,
 * because a row the user adds afterwards has no descriptor.
 *
 * Without this, the contract can *describe* a nested form that nothing can *instantiate*, and any
 * caller needing a live nested form has to read some other model instead. That is a gap in the
 * contract's runtime support, not a preference about how to build forms.
 */
export function buildDynamicFormSchema(schema: MdyDynamicGroupNode): MdyFormSchema {
  const build = (node: MdyDynamicNode, name: string): unknown => {
    if (node.node === "field") {
      const descriptor = { ...node.field, name } as MdyDynamicField;
      // `marksRequired` is not passed on: a `required()` validator in the list already raises the
      // field's own `required` signal, so the flag would be a second spelling of the same fact.
      const { validators } = buildDynamicFieldValidators(descriptor);
      return field(mdyEmptyValueFor(descriptor) as never, validators as never);
    }
    if (node.node === "group") {
      const children: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.children)) children[key] = build(child, key);
      return group(children as MdyFormSchema);
    }
    if (node.node === "record") {
      // Same template idea as an array's item: one row shape, whatever key it ends up under.
      return record(build(node.item, name) as never, {
        ...(node.initialValue !== undefined ? { initial: node.initialValue } : {}),
      });
    }
    // The item descriptor is the template every row is built from, which is what keeps a pushed row
    // identical to an initial one.
    const validators: ValidatorFn<readonly unknown[]>[] = [];
    if (node.minItems !== undefined) validators.push(minLength(node.minItems) as ValidatorFn<readonly unknown[]>);
    if (node.maxItems !== undefined) validators.push(maxLength(node.maxItems) as ValidatorFn<readonly unknown[]>);
    return array(build(node.item, name) as never, {
      ...(node.initialValue !== undefined ? { initial: node.initialValue } : {}),
      ...(validators.length ? { validators } : {}),
    });
  };

  const root: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(schema.children)) root[key] = build(child, key);
  return root as MdyFormSchema;
}

/**
 * Turns a document's `validations` into form-level validator functions.
 *
 * Each becomes a {@link crossField} over the paths its condition reads, so it re-runs when any of
 * them changes; the paths are derived from the expression rather than declared beside it, because a
 * dependency list maintained by hand is a list that stops matching the condition.
 *
 * A `target` narrows where the error lands. Without one the error is form-level, which `crossField`
 * already expresses as an empty path list.
 */
export function buildDynamicValidations(
  validations: ReadonlyArray<MdyDynamicValidation>,
): ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>> {
  return validations.map((validation) => {
    const paths = validation.target !== undefined ? [validation.target] : expressionPaths(validation.when);
    return crossField(paths, (value) => (evaluateExpression(validation.when, value) ? validation.message : null));
  });
}
