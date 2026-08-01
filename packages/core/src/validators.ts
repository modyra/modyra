import { MdyFormValidatorFn, ValidatorFn } from "./types.js";

/**
 * Built-in pure validator functions.
 * All validators are pure functions — they receive a value and return
 * an array of error strings (empty = valid).
 *
 * Compose multiple validators with `compose()`.
 */

/**
 * Marker attached to validators that semantically mark a field as required.
 * `mdyForm()` reads it to drive the field's `required` signal (aria-required)
 * without needing a separate flag in the schema.
 */
export const MDY_MARKS_REQUIRED: unique symbol = Symbol("mdyMarksRequired");

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
  return Object.assign(fn, { [MDY_MARKS_REQUIRED]: true });
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

/** Minimum string/array length */
export const minLength = (min: number, message?: string): ValidatorFn<string | readonly unknown[]> =>
  (value) => {
    const len = value?.length ?? 0;
    return len < min
      ? [message ?? `Minimum length is ${min}`]
      : [];
  };

/** Maximum string/array length */
export const maxLength = (max: number, message?: string): ValidatorFn<string | readonly unknown[]> =>
  (value) => {
    const len = value?.length ?? 0;
    return len > max
      ? [message ?? `Maximum length is ${max}`]
      : [];
  };

/** Email format validator */
export const email = (message = 'Invalid email address'): ValidatorFn<string | null> =>
  (value) => {
    if (!value) return [];
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value) ? [] : [message];
  };

/** RegExp pattern validator */
export const pattern = (regex: RegExp, message = 'Invalid format'): ValidatorFn<string | null> =>
  (value) => {
    if (!value) return [];
    return regex.test(value) ? [] : [message];
  };

/** Numeric minimum */
export const min = (minimum: number, message?: string): ValidatorFn<number | null> =>
  (value) => {
    if (value === null || value === undefined) return [];
    return value < minimum
      ? [message ?? `Minimum value is ${minimum}`]
      : [];
  };

/** Numeric maximum */
export const max = (maximum: number, message?: string): ValidatorFn<number | null> =>
  (value) => {
    if (value === null || value === undefined) return [];
    return value > maximum
      ? [message ?? `Maximum value is ${maximum}`]
      : [];
  };

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
  (value: T): readonly string[] =>
    validators.flatMap(v => v(value));

/** Same as compose but stops at first failing validator */
export const composeFirst = <T>(
  ...validators: readonly ValidatorFn<T>[]
): ValidatorFn<T> =>
  (value: T): readonly string[] => {
    for (const v of validators) {
      const errors = v(value);
      if (errors.length > 0) return errors;
    }
    return [];
  };

/**
 * Builds a form-level (cross-field) validator.
 *
 * `validate` receives the whole form value; when it returns one or more
 * messages, each is attributed to every path in `paths`, so the involved
 * fields all show the error and become invalid together. Pass an empty
 * `paths` array to attribute the error to the form itself (`path: null`).
 *
 * ```ts
 * const form = mdyForm(schema, {
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
