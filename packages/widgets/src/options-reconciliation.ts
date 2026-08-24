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
import { defaultOptionKey } from "./options-utils.js";

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
 * `1` and they are the same choice.
 *
 * Between objects the question is the same one and the answer is not `String()`: every plain object
 * renders as `[object Object]` through it, which would call two different entities one. The answer
 * is the key an option is identified by — the rule `oneOf` uses and the rule a part id is built from
 * (ADR 0051) — so an option that came back as a fresh object, which is what a restored draft, a
 * refetch and an import all produce, is the option it is a copy of. Compared by reference instead,
 * the list gained a second entry for a choice already in it, labelled with its own JSON and sharing
 * a key with the entry below it: a keyboard pointing at whichever the DOM found first.
 */
export function sameChoice(value: unknown, optionValue: unknown): boolean {
  if (Object.is(value, optionValue)) return true;
  if (value === null || value === undefined || optionValue === null || optionValue === undefined) {
    return false;
  }
  if (typeof value === "object" || typeof optionValue === "object") {
    if (typeof value !== "object" || typeof optionValue !== "object") return false;
    return defaultOptionKey(value) === defaultOptionKey(optionValue);
  }
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
  labelFor: (value: TValue) => string = readableLabel,
): readonly MdySelectOption<TValue>[] {
  if (value === null || value === undefined || value === "") return options;
  if (options.length === 0) return options;
  if (options.some((option) => sameChoice(value, option.value))) return options;
  return [{ value, label: labelFor(value) }, ...options];
}

/**
 * What an unrecognised value is called when nothing else names it.
 *
 * `String(value)` is right for the case this module was written for — a form holds `"fr"`, the list
 * arrives without it, and `fr` is what the user sees. It is wrong for the case the value contracts
 * also allow: `String({id: 1, name: "Ada"})` is `[object Object]`, and the rule here is *what it
 * will not erase, it has to show*. A field reading `[object Object]` is worse than a cleared one —
 * cleared is visibly empty, while that looks like a value and gives nothing to act on.
 *
 * A caller that still holds the option this value came from should pass `labelFor` and name it
 * properly; this is the answer for a value that arrived from a draft or a patch and was never in any
 * list.
 */
function readableLabel(value: unknown): string {
  return typeof value === "object" && value !== null ? defaultOptionKey(value) : String(value);
}

/**
 * The multi-value form of {@link optionsWithUnrecognizedValue}.
 *
 * A widget that holds several values has the same duty as one that holds one: what it will not
 * erase, it has to show. Unrecognised values come first, in the order the value holds them, and are
 * named by themselves — supply an option to name one differently.
 *
 * A value that is not a list is one value, as its singular sibling has always treated it. The two
 * ask the same question of the same kind of input, and this one guarded emptiness while the other
 * guarded shape: given a string, a number or an object — all of which `patchValue` accepts and the
 * model holds — it threw from inside the effect that draws the widget, and an effect that throws
 * stops running. The control kept whatever it was showing before the write, reported itself valid,
 * and there was nothing on the page to read or correct.
 */
export function optionsWithUnrecognizedValues<TValue>(
  options: readonly MdySelectOption<TValue>[],
  values: readonly TValue[] | TValue | null | undefined,
  labelFor: (value: TValue) => string = readableLabel,
): readonly MdySelectOption<TValue>[] {
  if (values === null || values === undefined || options.length === 0) return options;
  const held: readonly TValue[] = Array.isArray(values) ? values : [values as TValue];
  if (held.length === 0) return options;
  const unrecognized = held.filter(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !options.some((option) => sameChoice(value, option.value)),
  );
  if (unrecognized.length === 0) return options;
  return [
    ...unrecognized.map((value) => ({ value, label: labelFor(value) })),
    ...options,
  ];
}
