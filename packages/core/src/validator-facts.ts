/**
 * What a rule declares about itself, and how two rules add up.
 *
 * A validator is a function, and a function tells a control nothing: given `maxLength(50)` a text
 * input has no way to stop the fifty-first character, and given `required()` it has no way to say
 * so to a screen reader. Each of those had been solved once, separately, by hanging a marker on the
 * function — and neither survived `compose()`, which is how `compose(required(), …)` came to produce
 * a field that was not marked required at all.
 *
 * So a rule carries **facts**: the things it enforces that something else can act on. The facts of a
 * list of rules add up, every combinator carries the sum of what it combines, and a field reports
 * the total. One definition, in one place, instead of one per caller.
 *
 * A fact is not an outcome. `compose(required(), …)` declares "required" even along a path where
 * the rule would pass, because the fact describes the rule, not what it does to a particular value.
 */
import type { ValidatorFn } from "./contracts/validators.js";

/**
 * Marker attached to validators that semantically mark a field as required.
 * `mdyForm()` reads it to drive the field's `required` signal (aria-required)
 * without needing a separate flag in the schema.
 */
export const MDY_MARKS_REQUIRED: unique symbol = Symbol("mdyMarksRequired");

/** Marker carrying the constraints a validator enforces. */
export const MDY_VALIDATOR_FACTS: unique symbol = Symbol("mdyValidatorFacts");

/**
 * The constraints a field's rules state, for a control to offer at the keyboard.
 *
 * Every member has a native counterpart, which is the whole membership test: a rule that no input
 * can express — a cross-field comparison, a server check, a bespoke predicate — declares nothing
 * here and stays a rule.
 */
export interface MdyFieldConstraints {
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  /** Source of a regular expression, as `<input pattern>` spells it. */
  readonly pattern: string | null;
  /**
   * `<input inputmode>` where a rule implies one, e.g. `email()` asking for the address keyboard.
   *
   * There is deliberately no `inputType` beside it: **the kind decides what the input is**, and a
   * rule that could change it would let a validator turn a text field into a colour picker. A rule
   * that wants a different control asks for a different kind.
   */
  readonly inputMode: string | null;
}

/** What a rule declares. Every member optional: most rules declare one thing, many declare none. */
export interface MdyValidatorFacts {
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly inputMode?: string;
}

/** A field with no rules constrains nothing. */
export const NO_CONSTRAINTS: MdyFieldConstraints = {
  min: null,
  max: null,
  step: null,
  minLength: null,
  maxLength: null,
  pattern: null,
  inputMode: null,
};

/** Attaches facts to a validator, keeping the function itself untouched. */
export function withFacts<T>(
  fn: ValidatorFn<T>,
  facts: MdyValidatorFacts,
): ValidatorFn<T> {
  // A wrapper rather than a tag on the caller's function: this is exported, so the function handed
  // in may be one the caller uses elsewhere, and hanging facts on it would change a rule they did
  // not ask to change.
  const declared: ValidatorFn<T> = (value) => fn(value);
  return Object.assign(declared, { [MDY_VALIDATOR_FACTS]: { ...factsOf(fn), ...facts } });
}

/** What a single rule declares, including the standalone required marker an adapter may have set. */
export function factsOf(fn: unknown): MdyValidatorFacts {
  if (typeof fn !== "function") return {};
  const facts = Reflect.get(fn, MDY_VALIDATOR_FACTS) as MdyValidatorFacts | undefined;
  const required = Reflect.get(fn, MDY_MARKS_REQUIRED) === true;
  if (facts && required) return { ...facts, required: true };
  if (facts) return facts;
  return required ? { required: true } : {};
}

/**
 * The sum of what a list of rules declares.
 *
 * Where two rules bound the same thing the **tightest wins**: each was added to exclude something,
 * and widening either would admit what one of them refuses. A bound that is not a finite number
 * states nothing an input can carry — `min="NaN"` is ignored by the browser and misleading in a
 * diff — so it is dropped while its rule still runs.
 *
 * Two *different* patterns cannot be combined into one: an input carries a single `pattern`, and
 * inventing an intersection would be a rule nobody wrote. The field then offers none, and both
 * rules stay in force. {@link mergeFacts} reports that case so a caller can say so.
 */
export function mergeFacts(facts: readonly MdyValidatorFacts[]): {
  readonly constraints: MdyFieldConstraints;
  readonly required: boolean;
  /** True when more than one distinct pattern was declared, so none is offered. */
  readonly conflictingPatterns: boolean;
} {
  /**
   * How each constraint combines with another of its kind.
   *
   * A table rather than a chain of branches: a fact added tomorrow does not compile until it says
   * how two of them add up, which is the one thing about it that cannot be guessed.
   */
  const COMBINE = {
    min: (a: number, b: number) => Math.max(a, b),
    max: (a: number, b: number) => Math.min(a, b),
    // A coarser step admits fewer values, so it is the tighter of two.
    step: (a: number, b: number) => Math.max(a, b),
    minLength: (a: number, b: number) => Math.max(a, b),
    maxLength: (a: number, b: number) => Math.min(a, b),
  } as const;

  const numbers: { -readonly [K in keyof typeof COMBINE]: number | null } = {
    min: null, max: null, step: null, minLength: null, maxLength: null,
  };
  let required = false;
  let inputMode: string | null = null;
  const patterns = new Set<string>();

  for (const fact of facts) {
    if (fact.required === true) required = true;
    for (const key of Object.keys(COMBINE) as Array<keyof typeof COMBINE>) {
      const stated = fact[key];
      // A bound that is not a finite number states nothing an input can carry — `min="NaN"` is
      // ignored by the browser and misleading in a diff — so it is dropped while its rule runs.
      if (stated === undefined || !Number.isFinite(stated)) continue;
      const held = numbers[key];
      numbers[key] = held === null ? stated : COMBINE[key](held, stated);
    }
    if (fact.pattern !== undefined) patterns.add(fact.pattern);
    if (fact.inputMode !== undefined) inputMode ??= fact.inputMode;
  }

  const conflictingPatterns = patterns.size > 1;
  return {
    required,
    conflictingPatterns,
    constraints: {
      ...numbers,
      pattern: conflictingPatterns ? null : [...patterns][0] ?? null,
      inputMode,
    },
  };
}

/** The sum of what a list of validators declares. */
export function factsOfAll(validators: Iterable<unknown>): ReturnType<typeof mergeFacts> {
  return mergeFacts([...validators].map((fn) => factsOf(fn)));
}
