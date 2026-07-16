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
export const MDY_MARKS_REQUIRED = Symbol("mdyMarksRequired");
/** Fail if value is null, undefined, empty string, or empty array */
export const required = (message = 'This field is required') => {
    const fn = (value) => {
        if (value === null || value === undefined)
            return [message];
        if (typeof value === 'string' && value.trim() === '')
            return [message];
        if (Array.isArray(value) && value.length === 0)
            return [message];
        return [];
    };
    return Object.assign(fn, { [MDY_MARKS_REQUIRED]: true });
};
/** Minimum string/array length */
export const minLength = (min, message) => (value) => {
    const len = value?.length ?? 0;
    return len < min
        ? [message ?? `Minimum length is ${min}`]
        : [];
};
/** Maximum string/array length */
export const maxLength = (max, message) => (value) => {
    const len = value?.length ?? 0;
    return len > max
        ? [message ?? `Maximum length is ${max}`]
        : [];
};
/** Email format validator */
export const email = (message = 'Invalid email address') => (value) => {
    if (!value)
        return [];
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value) ? [] : [message];
};
/** RegExp pattern validator */
export const pattern = (regex, message = 'Invalid format') => (value) => {
    if (!value)
        return [];
    return regex.test(value) ? [] : [message];
};
/** Numeric minimum */
export const min = (minimum, message) => (value) => {
    if (value === null || value === undefined)
        return [];
    return value < minimum
        ? [message ?? `Minimum value is ${minimum}`]
        : [];
};
/** Numeric maximum */
export const max = (maximum, message) => (value) => {
    if (value === null || value === undefined)
        return [];
    return value > maximum
        ? [message ?? `Maximum value is ${maximum}`]
        : [];
};
/**
 * Compose multiple validators into one.
 * Runs all validators and merges their errors.
 * Use `composeFirst` to stop at the first failing validator instead.
 */
export const compose = (...validators) => (value) => validators.flatMap(v => v(value));
/** Same as compose but stops at first failing validator */
export const composeFirst = (...validators) => (value) => {
    for (const v of validators) {
        const errors = v(value);
        if (errors.length > 0)
            return errors;
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
export const crossField = (paths, validate, kind = 'cross-field') => (value) => {
    const result = validate(value);
    const messages = result === null ? [] : typeof result === 'string' ? [result] : result;
    if (messages.length === 0)
        return [];
    const targets = paths.length > 0 ? paths : [null];
    return messages.flatMap(message => targets.map(path => ({ path, kind, message })));
};
