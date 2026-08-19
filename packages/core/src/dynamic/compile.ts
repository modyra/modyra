/**
 * Turning a document into the engine's own vocabulary.
 *
 * The document is already trusted by the time it reaches here: `./parse.ts` decides what a
 * document is allowed to say, and this decides what the engine is asked to do about it.
 */

import { array, field, group, record, type MdyFormSchema } from "../typed-form.js";
import type { MdyFormValidatorFn, ValidatorFn } from "../types.js";
import { evaluateExpression, evaluateRuleCondition, expressionPaths } from "../expression.js";
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
import { dynamicPatternRefusal } from "./pattern-cost.js";
import {
  mdyEmptyValueFor,
  type MdyDynamicField,
  type MdyDynamicGroupNode,
  type MdyDynamicNode,
  type MdyDynamicValidators,
} from "./schema.js";
import type { MdyDynamicRule, MdyDynamicValidation } from "./parse.js";
import type { MdyReactivity, MdySignal } from "../reactivity-contract.js";

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
      // Cost, on the same terms as syntax: a pattern whose shape backtracks exponentially stops the
      // field answering — the match is synchronous, so it is the whole thread — and a document is
      // not a place to accept that from. Refused the way an unparseable source is: a diagnostic and
      // no validator, rather than a form that half-works.
      const refusal = dynamicPatternRefusal(config.pattern);
      if (refusal !== null) {
        warnDev(
          `Skipped dynamic pattern validator: "${config.pattern}" has ${refusal}.`,
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

/**
 * An option list a control cannot show is refused where the rules are compiled.
 *
 * `parseDynamicForm` already refuses a malformed list with `MDY_DYNAMIC_OPTIONS_REQUIRED`, and a
 * host assembling its own fields reaches this without passing through it. Left alone, a list of bare
 * strings compiled a rule that rejects every value — the option's `value` is `undefined`, so nothing
 * matches — and the sentence a person read was `Value must be one of: undefined, undefined`.
 *
 * Thrown rather than dropped, because there is no diagnostic channel on this path: the parser has
 * one and reports there, and this is the door taken by a caller who has no document to report about.
 */
/**
 * The sentence a refused choice reads, built from what the options are *called*.
 *
 * `oneOf` is handed values, and a value is what a document stores rather than what a person sees —
 * an id, a code. The label is the half the person can match against the list in front of them, and a
 * document that declared one has already said which words to use.
 */
function optionListMessage(
  options: ReadonlyArray<{ readonly label?: string; readonly value: unknown }>,
  subject = "Value",
): string {
  if (options.length === 0) return "There are no choices to pick from.";
  const named = options.map((option) => option.label ?? String(option.value));
  return `${subject} must be one of: ${named.join(", ")}`;
}

/**
 * A bound written beside the field is a rule as well as a range.
 *
 * A number's limits can be said twice — `{ kind: "number", min: 0, max: 10 }` and
 * `{ validators: { min: 0, max: 10 } }` — and both render the same attributes on the control, so a
 * browser refuses what a person types either way. Only the second was a rule: a value that did not
 * come from the keyboard — a prefill, a restored draft, a scripted write — passed the first
 * untouched, and the form called itself valid holding it.
 *
 * The slider is where it shows: a value of 150 against `max: 50` left the form holding 150 and the
 * page showing the thumb at 50, with `aria-invalid="false"` and nothing said. The two spellings
 * render identically; only one of them meant anything.
 *
 * Read from the *field's* bound rather than from the control's drawn range. The range is already
 * derived from the rules (`VAL-004`: a native constraint never promises less than the validators it
 * came from), so deriving a rule from the range would close a loop — a rule from a range from a
 * rule — and the day the projection changes, the loop changes meaning with nothing to say so.
 *
 * The explicit `validators` entry wins where both are written: it is the narrower statement of
 * intent, and `mergeFacts` already takes whichever promises less when the two disagree.
 *
 * `step` has no rule to generate — the validator vocabulary has no `step` — so it stays what it
 * always was: an affordance at the keyboard, and nothing the form asserts.
 */
function withFieldBounds(field: MdyDynamicField): MdyDynamicValidators {
  const declared = field.validators ?? {};
  if (field.kind !== "number" && field.kind !== "slider") return declared;
  return {
    ...declared,
    min: declared.min ?? field.min,
    max: declared.max ?? field.max,
  };
}

const KINDS_NEEDING_OPTIONS = new Set(["select", "radio", "multiselect", "segmented"]);

function assertUsableOptions(field: { readonly kind: string; readonly name?: string; readonly options?: unknown }): void {
  if (!KINDS_NEEDING_OPTIONS.has(field.kind)) return;
  // The list is missing entirely, which reached the compiler as `undefined.map` — an engine internal
  // on a caller's mistake, and the same absence the parser reports as `MDY_DYNAMIC_OPTIONS_REQUIRED`.
  if (
    Array.isArray(field.options) &&
    field.options.every((option) => typeof option === "object" && option !== null && "value" in option)
  ) return;
  throw new Error(
    `[modyra] The options for "${field.name ?? field.kind}" must each name a value: { value, label }. ` +
    "A list the contract cannot read compiles a rule no value satisfies.",
  );
}

export function buildDynamicFieldValidators(field: MdyDynamicField): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  assertUsableOptions(field);
  const declared = buildDynamicValidators(withFieldBounds(field));
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
      validators: [...base.validators, oneOf(values, optionListMessage(field.options)) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  if (field.kind === "multiselect") {
    const values = field.options.map((option) => option.value);
    return {
      validators: [
        ...base.validators,
        eachOneOf(values, optionListMessage(field.options, "Every value")) as ValidatorFn<never>,
      ],
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
  // The root of a parsed document, or nothing this can walk. `parseDynamicForm` is the door that
  // produces one; a caller arriving here with something else got a `TypeError` about `children` or
  // about converting null, which names neither the argument nor this call.
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    throw new Error(
      `[modyra] buildDynamicFormSchema takes a document's root group node, received ${
        schema === null ? "null" : Array.isArray(schema) ? "an array" : `a ${typeof schema}`
      }. It is the document's own \`schema\`: buildDynamicFormSchema(document.schema).`,
    );
  }
  // A group with nothing in it is the shape this refusal exists for — an empty document, or a
  // section someone left half-written — and it was the one shape that missed it: reading `children`
  // off an object that has none reached `Object.entries(undefined)` and raised an internal.
  const children = (schema as { children?: unknown }).children;
  if (typeof children !== "object" || children === null || Array.isArray(children)) {
    throw new Error(
      "[modyra] buildDynamicFormSchema takes a document's root group node, and this one declares no " +
      "children. It is the document's own `schema`: buildDynamicFormSchema(document.schema).",
    );
  }
  /**
   * Built bottom-up over an explicit stack, for the reason `validateDynamicSchema` is: a document is
   * untrusted, its nesting has no cap, and a recursive walk lets the document decide how much stack
   * to use. Overflowing is not a refusal a consumer can act on — it carries no path, cannot be
   * caught by name, and looks exactly like a bug in their own code.
   */
  const built = new Map<MdyDynamicNode, unknown>();
  const leaf = (node: MdyDynamicNode & { node: "field" }, name: string): unknown => {
    const descriptor = { ...node.field, name } as MdyDynamicField;
    // `marksRequired` is not passed on: a `required()` validator in the list already raises the
    // field's own `required` signal, so the flag would be a second spelling of the same fact.
    const { validators } = buildDynamicFieldValidators(descriptor);
    // The one property in a document that names secrecy. Carried onto the descriptor so the form
    // itself knows, rather than leaving every protection to a list the application passes.
    return field(mdyEmptyValueFor(descriptor) as never, validators as never, {
      sensitive: descriptor.sensitive === true,
    });
  };

  const build = (node: MdyDynamicNode, name: string): unknown => {
    const pending: Array<{ node: MdyDynamicNode; name: string; expanded: boolean }> = [
      { node, name, expanded: false },
    ];
    while (pending.length > 0) {
      const frame = pending[pending.length - 1]!;
      if (frame.node.node === "field") {
        built.set(frame.node, leaf(frame.node, frame.name));
        pending.pop();
        continue;
      }
      if (!frame.expanded) {
        frame.expanded = true;
        if (frame.node.node === "group") {
          for (const [key, child] of Object.entries(frame.node.children)) {
            pending.push({ node: child, name: key, expanded: false });
          }
        } else {
          pending.push({ node: frame.node.item, name: frame.name, expanded: false });
        }
        continue;
      }
      pending.pop();
      if (frame.node.node === "group") {
        const children: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(frame.node.children)) children[key] = built.get(child);
        built.set(frame.node, group(children as MdyFormSchema));
        continue;
      }
      const item = built.get(frame.node.item) as never;
      if (frame.node.node === "record") {
        // Same template idea as an array's item: one row shape, whatever key it ends up under.
        built.set(frame.node, record(item, {
          ...(frame.node.initialValue !== undefined ? { initial: frame.node.initialValue } : {}),
        }));
        continue;
      }
      // The item descriptor is the template every row is built from, which is what keeps a pushed
      // row identical to an initial one.
      const validators: ValidatorFn<readonly unknown[]>[] = [];
      if (frame.node.minItems !== undefined) validators.push(minLength(frame.node.minItems) as ValidatorFn<readonly unknown[]>);
      if (frame.node.maxItems !== undefined) validators.push(maxLength(frame.node.maxItems) as ValidatorFn<readonly unknown[]>);
      built.set(frame.node, array(item, {
        ...(frame.node.initialValue !== undefined ? { initial: frame.node.initialValue } : {}),
        ...(validators.length ? { validators } : {}),
      }));
    }
    return built.get(node);
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
/**
 * What a rule needs of the form it applies to.
 *
 * Structural rather than the concrete class: `MdyTypedForm` and the engine both satisfy it, and an
 * adapter's own form does too as long as it speaks the registry's language.
 */
export interface MdyDynamicRuleHost {
  /** The runtime the form's own signals are built with, so a condition is tracked by it. */
  readonly reactivity: MdyReactivity;
  readonly value: MdySignal<Record<string, unknown>>;
  setInactive(name: string, inactive: MdySignal<boolean>): void;
  setDisabled(name: string, disabled: MdySignal<boolean>): void;
}

/**
 * Turns a document's `rules` into the bindings the engine already has for them.
 *
 * The sibling of {@link buildDynamicValidations}: the parser reads both slots as behaviour — it
 * refuses an undeclared effect, an undeclared operator and a target that is not a field — and one of
 * them had no way to become behaviour. A document that said "hide the VAT number unless the customer
 * is a business" parsed, was accepted in strict mode, and produced a form that showed it always.
 *
 * Applied rather than returned, because a rule is a binding on a named field and not a value a
 * caller could hold: `visible`/`hidden` take a field out of play, which is what `setInactive` means,
 * and `enabled`/`disabled` reach `setDisabled`. Out of play and disabled are different promises —
 * a field out of play is not asked for at all, a disabled one is asked for and not answered — and
 * the four effects are two pairs over exactly that difference.
 *
 * One signal per field per effect, however many rules name it: the engine's binding replaces rather
 * than accumulates, so composing here is what stops the last rule silently winning.
 */
export function applyDynamicRules(
  form: MdyDynamicRuleHost,
  rules: ReadonlyArray<MdyDynamicRule>,
): void {
  const inactive = new Map<string, MdyDynamicRule[]>();
  const disabled = new Map<string, MdyDynamicRule[]>();
  for (const rule of rules) {
    const into = rule.effect === "visible" || rule.effect === "hidden" ? inactive : disabled;
    const held = into.get(rule.target);
    if (held) held.push(rule);
    else into.set(rule.target, [rule]);
  }

  /**
   * Whether the rules that name one field, taken together, leave it out.
   *
   * The two effects are not each other's negation once there is more than one rule. A positive rule
   * is a **way in**: "show this for a business" and "show this for a charity" are alternatives, so
   * any one of them holding is enough. A negative rule is a **veto**: "hide it while the account is
   * closed" holds whatever else is true.
   *
   * Composing both sides as "off if any says off" reads the positives as conditions that must all
   * hold — the opposite of what two of them mean — and a field with two `visible` rules is then
   * shown to nobody. So the positives are `some` over *in*, the negatives are `some` over *out*, and
   * a veto beats a way in.
   */
  const isOut = (own: readonly MdyDynamicRule[], value: Record<string, unknown>): boolean => {
    const vetoed = own.some((rule) =>
      (rule.effect === "hidden" || rule.effect === "disabled") && evaluateRuleCondition(rule.when, value));
    if (vetoed) return true;
    const ways = own.filter((rule) => rule.effect === "visible" || rule.effect === "enabled");
    return ways.length > 0 && !ways.some((rule) => evaluateRuleCondition(rule.when, value));
  };

  for (const [target, own] of inactive) {
    form.setInactive(target, form.reactivity.computed(() => isOut(own, form.value())));
  }
  for (const [target, own] of disabled) {
    form.setDisabled(target, form.reactivity.computed(() => isOut(own, form.value())));
  }
}

export function buildDynamicValidations(
  validations: ReadonlyArray<MdyDynamicValidation>,
): ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>> {
  return validations.map((validation) => {
    const paths = validation.target !== undefined ? [validation.target] : expressionPaths(validation.when);
    return crossField(paths, (value) => (evaluateExpression(validation.when, value) ? validation.message : null));
  });
}
