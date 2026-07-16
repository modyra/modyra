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
export declare const MDY_MARKS_REQUIRED: unique symbol;
/** Fail if value is null, undefined, empty string, or empty array */
export declare const required: <T>(message?: string) => ValidatorFn<T>;
/** Minimum string/array length */
export declare const minLength: (min: number, message?: string) => ValidatorFn<string | readonly unknown[]>;
/** Maximum string/array length */
export declare const maxLength: (max: number, message?: string) => ValidatorFn<string | readonly unknown[]>;
/** Email format validator */
export declare const email: (message?: string) => ValidatorFn<string | null>;
/** RegExp pattern validator */
export declare const pattern: (regex: RegExp, message?: string) => ValidatorFn<string | null>;
/** Numeric minimum */
export declare const min: (minimum: number, message?: string) => ValidatorFn<number | null>;
/** Numeric maximum */
export declare const max: (maximum: number, message?: string) => ValidatorFn<number | null>;
/**
 * Compose multiple validators into one.
 * Runs all validators and merges their errors.
 * Use `composeFirst` to stop at the first failing validator instead.
 */
export declare const compose: <T>(...validators: readonly ValidatorFn<T>[]) => ValidatorFn<T>;
/** Same as compose but stops at first failing validator */
export declare const composeFirst: <T>(...validators: readonly ValidatorFn<T>[]) => ValidatorFn<T>;
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
export declare const crossField: <TValue extends Record<string, unknown>>(paths: readonly string[], validate: (value: TValue) => string | readonly string[] | null, kind?: string) => MdyFormValidatorFn<TValue>;
