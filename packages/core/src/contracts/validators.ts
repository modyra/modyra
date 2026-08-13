/**
 * What a rule is: a function from a value to the reasons it was refused.
 *
 * A leaf, and deliberately: a field's state carries the constraints a rule declares, and the facts
 * module types its combinators by the rule they combine. Either owning this makes the other import
 * it back, which is the cycle this module exists to prevent.
 */

/** Returns the error keys a value violates — empty means it passes. */
export type ValidatorFn<TValue = unknown> = (
  value: TValue,
) => readonly string[];
