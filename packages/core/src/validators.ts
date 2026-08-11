import { MdyFormValidatorFn, ValidatorFn } from "./types.js";
import { MDY_VALUE_CONTRACTS, matchesValueShape, type MdyValueKind } from "./value-contracts.js";
import { factsOf, mergeFacts, withFacts, type MdyValidatorFacts } from "./validator-facts.js";

/**
 * Built-in pure validator functions.
 * All validators are pure functions — they receive a value and return
 * an array of error strings (empty = valid).
 *
 * Compose multiple validators with `compose()`.
 */

export { MDY_MARKS_REQUIRED } from "./validator-facts.js";

/**
 * Whether a start/end pair has both endpoints unset.
 *
 * Structural on purpose: `@modyra/core` does not import a widget's value type, and any
 * `{ start, end }` a caller supplies means the same thing here.
 */
function rangeEndpoints(value: unknown): { start: boolean; end: boolean } | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("start" in value) || !("end" in value)) return null;
  const { start, end } = value as { start: unknown; end: unknown };
  // A cleared date input reports `""`, not null, so an endpoint is set only when it holds
  // something. Both halves answer to the same predicate — `required` and `completeRange`
  // disagreeing about what "set" means is how a range ends up empty *and* incomplete.
  const isSet = (endpoint: unknown): boolean =>
    endpoint !== null && endpoint !== undefined && endpoint !== "";
  return { start: isSet(start), end: isSet(end) };
}

function isEmptyRange(value: unknown): boolean {
  const endpoints = rangeEndpoints(value);
  return endpoints !== null && !endpoints.start && !endpoints.end;
}

/**
 * Fail if the value is empty.
 *
 * "Empty" is per shape, not per type. A field's empty value depends on what it holds, so a rule
 * that only understands strings and nullish values silently passes every other kind:
 *
 * - `null` / `undefined`
 * - a blank string
 * - an empty array — an unselected multiselect
 * - `false` — an unchecked checkbox or an off toggle, as in HTML, where
 *   `<input type="checkbox" required>` unchecked does not satisfy the constraint. A toggle whose
 *   "off" is a real answer should simply not be marked required.
 * - a `{ start, end }` pair with both ends unset. A *partial* range is not empty and is not this
 *   validator's business — it is invalid on its own terms, see {@link completeRange}.
 */
export const required = <T>(message = 'This field is required'): ValidatorFn<T> => {
  const fn = (value: T): readonly string[] => {
    if (value === null || value === undefined) return [message];
    if (typeof value === 'string' && value.trim() === '') return [message];
    if (Array.isArray(value) && value.length === 0) return [message];
    if (value === false) return [message];
    if (isEmptyRange(value)) return [message];
    return [];
  };
  return withFacts(fn, { required: true });
};

/**
 * Fail a value whose shape is not the one its kind holds.
 *
 * The counterpart of `oneOf` for kinds that have no option list: it guards the same doorway, which is
 * a value arriving from outside the widget — a restored draft, a network config, a scripted `set()`.
 * A string field handed `42` used to report itself valid, because every rule it had asked whether the
 * value was *empty* and none asked whether it was a string.
 *
 * Nullish is not its business: whether a field may be empty is `required`'s question, and answering
 * it here too would make an optional field invalid for holding nothing.
 */
export const valueShape = <T>(
  kind: MdyValueKind,
  message?: string,
): ValidatorFn<T> => (value) => {
  if (value === null || value === undefined) return [];
  const contract = MDY_VALUE_CONTRACTS[kind];
  if (!contract || matchesValueShape(contract.shape, value)) return [];
  return [message ?? `This field holds ${contract.shape}`];
};

/**
 * Fail a start/end pair that has one endpoint and not the other.
 *
 * A range is a single value with two halves, so half of one is not a partially-entered value the
 * way half a postcode is — it names no interval at all. This holds **independently of
 * `required`**: an optional range may be left entirely empty, and may not be left half-set.
 *
 * Empty is deliberately allowed here. Whether an empty range is acceptable is `required`'s
 * question, and answering it twice would give a field two errors for one mistake.
 */
export const completeRange = <T>(
  message = 'Enter both a start and an end date',
): ValidatorFn<T> => (value) => {
  const endpoints = rangeEndpoints(value);
  if (endpoints === null) return [];
  return endpoints.start === endpoints.end ? [] : [message];
};

/**
 * Minimum string/array length. Empty passes: a field that may hold nothing is an ordinary optional
 * field, and the type says so — pairing this with `required()` is what makes emptiness fail.
 */
export const minLength = (
  min: number,
  message?: string,
): ValidatorFn<string | readonly unknown[] | null> =>
  withFacts((value) => {
    const len = value?.length ?? 0;
    return len < min
      ? [message ?? `Minimum length is ${min}`]
      : [];
  }, { minLength: min });

/** Maximum string/array length. Empty passes, for the reason given on {@link minLength}. */
export const maxLength = (
  max: number,
  message?: string,
): ValidatorFn<string | readonly unknown[] | null> =>
  withFacts((value) => {
    const len = value?.length ?? 0;
    return len > max
      ? [message ?? `Maximum length is ${max}`]
      : [];
  }, { maxLength: max });

/** Email format validator */
export const email = (message = 'Invalid email address'): ValidatorFn<string | null> =>
  withFacts((value) => {
    if (!value) return [];
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value) ? [] : [message];
    // Declared as a type rather than a pattern: `type="email"` brings the right keyboard and the
    // platform's own idea of an address, which is a better answer than this expression.
  }, { inputType: "email", inputMode: "email" });

/** RegExp pattern validator */
export const pattern = (regex: RegExp, message = 'Invalid format'): ValidatorFn<string | null> =>
  withFacts((value) => {
    if (!value) return [];
    return regex.test(value) ? [] : [message];
    // `<input pattern>` is anchored and has no flags, so only a source without them can be offered;
    // a flagged expression stays a rule, which is where it was working already.
  }, regex.flags === "" ? { pattern: regex.source } : {});

/** Numeric minimum. Empty passes — whether a field may be empty is `required`'s question. */
export const min = (minimum: number, message?: string): ValidatorFn<number | null> => {
  const fn = (value: number | null): readonly string[] => {
    if (value === null || value === undefined) return [];
    return value < minimum
      ? [message ?? `Minimum value is ${minimum}`]
      : [];
  };
  return withFacts(fn, { min: minimum });
};

/** Numeric maximum. Empty passes — whether a field may be empty is `required`'s question. */
export const max = (maximum: number, message?: string): ValidatorFn<number | null> => {
  const fn = (value: number | null): readonly string[] => {
    if (value === null || value === undefined) return [];
    return value > maximum
      ? [message ?? `Maximum value is ${maximum}`]
      : [];
  };
  return withFacts(fn, { max: maximum });
};

/**
 * Fail a number that is not a whole number.
 *
 * A count, an identifier and a quantity of things are integers, and a field that accepts `1.5` for
 * one of them reports itself valid and fails somewhere with no field to name — in a parser, a
 * column, a wire format. Empty passes, as every rule here does that is not `required`.
 *
 * For a bounded integer, compose: `compose(integer(), min(0), max(255))` states the range once and
 * the control reads it back through {@link MdyFieldState.bounds}.
 */
export const integer = (message = 'Enter a whole number'): ValidatorFn<number | null> =>
  withFacts((value) => {
    if (value === null || value === undefined) return [];
    return Number.isInteger(value) ? [] : [message];
  }, { step: 1 });

/**
 * Option whitelist: the value must be one of `values` (compared with
 * `Object.is`). This is the client-side anti-tampering guard for
 * option-based fields — a select offering "one"/"two" must not accept a
 * scripted `set("three")`. Empty values pass (pair with `required()` to
 * mandate a choice). Remember client-side checks are defense-in-depth:
 * the server must re-validate (see docs/guides/security.md).
 */
export const oneOf = (
  values: readonly unknown[],
  message?: string,
): ValidatorFn<unknown> =>
  (value) => {
    if (value === null || value === undefined || value === "") return [];
    return values.some((allowed) => Object.is(allowed, value))
      ? []
      : [message ?? `Value must be one of: ${values.map(String).join(", ")}`];
  };

/**
 * Array variant of {@link oneOf} (multiselects, checkbox groups): every
 * element must be in `values`. Non-array and empty values pass.
 */
export const eachOneOf = (
  values: readonly unknown[],
  message?: string,
): ValidatorFn<readonly unknown[] | null> =>
  (value) => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.every((item) => values.some((allowed) => Object.is(allowed, item)))
      ? []
      : [message ?? `Every value must be one of: ${values.map(String).join(", ")}`];
  };

/**
 * Compose multiple validators into one.
 * Runs all validators and merges their errors.
 * Use `composeFirst` to stop at the first failing validator instead.
 */
export const compose = <T>(
  ...validators: readonly ValidatorFn<T>[]
): ValidatorFn<T> =>
  withFacts(
    (value: T): readonly string[] => validators.flatMap(v => v(value)),
    factsOfComposed(validators),
  );

/** Same as compose but stops at first failing validator */
export const composeFirst = <T>(
  ...validators: readonly ValidatorFn<T>[]
): ValidatorFn<T> =>
  withFacts(
    (value: T): readonly string[] => {
      for (const v of validators) {
        const errors = v(value);
        if (errors.length > 0) return errors;
      }
      return [];
    },
    factsOfComposed(validators),
  );

/**
 * What a combination declares: the sum of its parts.
 *
 * Without this a composed rule is opaque — the field it guards reports no constraint and no required
 * marker, so a control offers nothing and a screen reader is told nothing, while the rules run as
 * written. A fact stated by a rule survives every way of combining it.
 */
function factsOfComposed<T>(validators: readonly ValidatorFn<T>[]): MdyValidatorFacts {
  const { constraints, required } = mergeFacts(validators.map((fn) => factsOf(fn)));
  return {
    ...(required ? { required: true } : {}),
    ...(constraints.min !== null ? { min: constraints.min } : {}),
    ...(constraints.max !== null ? { max: constraints.max } : {}),
    ...(constraints.step !== null ? { step: constraints.step } : {}),
    ...(constraints.minLength !== null ? { minLength: constraints.minLength } : {}),
    ...(constraints.maxLength !== null ? { maxLength: constraints.maxLength } : {}),
    ...(constraints.pattern !== null ? { pattern: constraints.pattern } : {}),
    ...(constraints.inputType !== null ? { inputType: constraints.inputType } : {}),
    ...(constraints.inputMode !== null ? { inputMode: constraints.inputMode } : {}),
  };
}

/**
 * Builds a form-level (cross-field) validator.
 *
 * `validate` receives the whole form value; when it returns one or more
 * messages, each is attributed to every path in `paths`, so the involved
 * fields all show the error and become invalid together. Pass an empty
 * `paths` array to attribute the error to the form itself (`path: null`).
 *
 * ```ts
 * const form = createForm(schema, {
 *   validators: [
 *     crossField(["password", "confirm"], v =>
 *       v.password === v.confirm ? null : "Passwords do not match"),
 *   ],
 * });
 * ```
 */
export const crossField = <TValue extends Record<string, unknown>>(
  paths: readonly string[],
  validate: (value: TValue) => string | readonly string[] | null,
  kind = 'cross-field',
): MdyFormValidatorFn<TValue> =>
  (value: TValue) => {
    const result = validate(value);
    const messages =
      result === null ? [] : typeof result === 'string' ? [result] : result;
    if (messages.length === 0) return [];
    const targets: ReadonlyArray<string | null> =
      paths.length > 0 ? paths : [null];
    return messages.flatMap(message =>
      targets.map(path => ({ path, kind, message })),
    );
  };
