/**
 * A value the options do not contain is still the value.
 *
 * Any control that offers a list faces this: a form holds `"fr"`, the options arrive without it, and
 * the control has to show something. Erasing the value loses data the person could have fixed; hiding
 * it shows a control that disagrees with the form. So the value stays and the list gains an entry for
 * it, marked as unrecognised.
 *
 * Neutral ground, deliberately. It lived under `select/` and the multiselect — which is in `field/` —
 * reached across for it, while `select/` reached the other way for the field shell. Two directions
 * between two folders is one module with two names.
 */
import type { MdySelectOption } from "@modyra/core";

export interface MdySelectReconciliationState<TValue> {
  readonly value: TValue | null;
  /**
   * Where a value used to be set aside while its option was missing. Always `null` on the way out:
   * an unrecognised value now stays in the model, so there is nothing to hold anywhere else.
   */
  readonly parkedValue: TValue | null;
}

/**
 * Whether a value and an option's value are the same choice.
 *
 * Loose between primitives, because a value read from JSON arrives as `"1"` where the option holds
 * `1` and they are the same choice. **Never loose between objects**: `String()` renders every plain
 * object as `[object Object]`, so a comparison through it says two different entities are the same
 * one — and the caller then replaces the model's entity with the option's.
 */
function sameChoice(value: unknown, optionValue: unknown): boolean {
  if (Object.is(value, optionValue)) return true;
  if (value === null || value === undefined || optionValue === null || optionValue === undefined) {
    return false;
  }
  if (typeof value === "object" || typeof optionValue === "object") return false;
  return String(value) === String(optionValue);
}

/**
 * Reconciles a programmatic value against a changing option set.
 *
 * Loading or filtering options is not a user edit, and neither is a value the option set does not
 * recognise. **The widget does not write to the model to make itself consistent**: a value outside
 * the list is a value the form holds and the rules can judge — `oneOf()` is how a select says it is
 * wrong — and erasing it destroys the one thing that would let the user fix it. That matters most
 * where the value came from outside: an import that carries the name of a category that does not
 * exist yet is exactly the row a person has to see in order to resolve it.
 *
 * What is still repaired is the *representation*: a value that matches an option loosely — `"1"`
 * against `1`, as a value read from JSON does — is replaced by the option's own value, so the model
 * holds what the list holds and identity comparisons work.
 */
export function reconcileSelectValue<TValue>(
  state: MdySelectReconciliationState<TValue>,
  options: readonly MdySelectOption<TValue>[],
): MdySelectReconciliationState<TValue> {
  const match = (value: TValue) =>
    options.find((option) => sameChoice(value, option.value));

  if (state.value !== null) {
    const matched = match(state.value);
    return matched
      ? { value: matched.value, parkedValue: null }
      : { value: state.value, parkedValue: null };
  }

  // A value parked by an earlier version of this function is still restored when its option
  // arrives; nothing parks a new one.
  if (state.parkedValue !== null) {
    const matched = match(state.parkedValue);
    if (matched) return { value: matched.value, parkedValue: null };
  }
  return state;
}

/**
 * The option list a select renders, with a place for a value the list does not contain.
 *
 * A value the model holds and the list cannot show is invisible: the control appears empty, the
 * user is told nothing, and the only clue is a validation message about a value they cannot see. So
 * the unrecognised value is rendered as an option of its own, selected, and labelled by `label`
 * — by default the value itself, which is the only honest thing to call something the list has no
 * name for.
 *
 * Nothing is added while the list is empty: options that have not loaded yet are not a list that
 * refuses the value, and a placeholder would flash on every load.
 */
export function optionsWithUnrecognizedValue<TValue>(
  options: readonly MdySelectOption<TValue>[],
  value: TValue | null,
): readonly MdySelectOption<TValue>[] {
  if (value === null || value === undefined || value === "") return options;
  if (options.length === 0) return options;
  if (options.some((option) => sameChoice(value, option.value))) return options;
  return [{ value, label: String(value) }, ...options];
}

/**
 * The multi-value form of {@link optionsWithUnrecognizedValue}.
 *
 * A widget that holds several values has the same duty as one that holds one: what it will not
 * erase, it has to show. Unrecognised values come first, in the order the value holds them, and are
 * named by themselves — supply an option to name one differently.
 */
export function optionsWithUnrecognizedValues<TValue>(
  options: readonly MdySelectOption<TValue>[],
  values: readonly TValue[] | null | undefined,
): readonly MdySelectOption<TValue>[] {
  if (!values || values.length === 0 || options.length === 0) return options;
  const unrecognized = values.filter(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !options.some((option) => sameChoice(value, option.value)),
  );
  if (unrecognized.length === 0) return options;
  return [
    ...unrecognized.map((value) => ({ value, label: String(value) })),
    ...options,
  ];
}
