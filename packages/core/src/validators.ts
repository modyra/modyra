import { MdyFieldError, MdyFormValidatorFn, ValidatorFn } from "./types.js";
import {
  explainValueMismatch,
  MDY_VALUE_CONTRACTS,
  matchesValueShape,
  type MdyValueKind,
} from "./value-contracts.js";
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
    // `NaN` is a number that answers nothing: it compares false against every bound, and
    // `JSON.stringify` writes it as `null` — so a field left like this used to report itself valid
    // and send nothing at all.
    if (typeof value === 'number' && Number.isNaN(value)) return [message];
    if (typeof value === 'string' && value.trim() === '') return [message];
    if (Array.isArray(value) && value.length === 0) return [message];
    if (value === false) return [message];
    if (isEmptyRange(value)) return [message];
    return [];
  };
  return withFacts(fn, { required: true }, { rule: "required", takes: [] });
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
/**
 * The origin a validator's refusals carry, written on the function itself.
 *
 * A rule the person has not answered yet and a value the field cannot hold are both "invalid" and
 * are not the same news. The first is about what they have not done — showing it before they reach
 * the field is telling somebody off for arriving — and the second is about what is already there,
 * which they can neither cause nor see the reason for unless it is said. The form knows which list
 * an error arrived in; this is how it knows which *rule* produced one.
 */
export function markOrigin<T>(origin: MdyFieldError["origin"], fn: ValidatorFn<T>): ValidatorFn<T> {
  return Object.assign(fn, { mdyErrorOrigin: origin });
}

/** The origin a validator declares for its refusals, or `"validation"` where it declares none. */
export function originOf(fn: unknown): NonNullable<MdyFieldError["origin"]> {
  const declared = (fn as { mdyErrorOrigin?: MdyFieldError["origin"] }).mdyErrorOrigin;
  return declared ?? "validation";
}

export const valueShape = <T>(
  kind: MdyValueKind,
  message?: string,
): ValidatorFn<T> => markOrigin("shape", (value: T) => {
  if (value === null || value === undefined) return [];
  const contract = MDY_VALUE_CONTRACTS[kind];
  if (!contract) return [];
  // The whole contract, not the shape alone: three kinds carry a string with a form — a date is ISO
  // `yyyy-MM-dd`, a time is `HH:mm` — and asking only about the shape left a datepicker holding
  // "not a date at all" with the form calling itself valid and submittable. A value from outside the
  // control is where that arrives: a tampered draft, a server response, a scripted write.
  const mismatch = explainValueMismatch(kind, value);
  if (mismatch === null) return [];
  return [message ?? (matchesValueShape(contract.shape, value)
    ? `This field holds ${mismatch.slice(mismatch.indexOf("holds") + 6)}`
    : `This field holds ${contract.shape}`)];
});

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
 * Minimum string or collection length.
 *
 * **A blank text field is not short, it is empty** — that is `required`'s question, and `<input
 * minlength>` agrees: the platform does not apply it to an empty value. So an empty string, and an
 * absent value, pass.
 *
 * **An empty collection is short.** `minLength(1)` on an array is how "at least one row" is said,
 * and exempting `[]` would take that away — the one thing the rule is most often there to do.
 */
export const minLength = (
  min: number,
  message?: string,
): ValidatorFn<string | readonly unknown[] | null> =>
  withFacts((value) => {
    if (value === null || value === undefined) return [];
    if (typeof value === "string" && value.length === 0) return [];
    return value.length < min
      ? [message ?? `Minimum length is ${min}`]
      : [];
  }, { minLength: min }, { rule: "minLength", takes: ["number"] });

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
  }, { maxLength: max }, { rule: "maxLength", takes: ["number"] });

/**
 * What `<input type="email">` accepts, as the HTML standard defines it.
 *
 * Deliberately more permissive than a "real" address check — `a@b` passes, because the browser
 * passes it — and deliberately ASCII, because the browser refuses anything else. A stricter rule is
 * a rule the control does not enforce, and every difference between them is a form that says one
 * thing and submits another.
 */
const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Email format validator */
export const email = (message = 'Invalid email address'): ValidatorFn<string | null> =>
  withFacts((value) => {
    if (!value) return [];
    // The rule the platform uses for `type="email"`, written out from the HTML standard rather than
    // approximated. A field of this kind is judged twice — by the control the browser draws and by
    // this — and two judges of one address must agree: `a@b` was refused here and accepted there,
    // `ünicode@example.com` the other way round. A person is then either invited to submit what will
    // be refused, or blocked by a browser over something nothing in the form objects to.
    return EMAIL.test(value) ? [] : [message];
    // The keyboard, not the type: which control this is belongs to the kind, and a rule that could
    // change it would let a validator turn a text field into something else.
  }, { inputMode: "email" }, { rule: "email", takes: [] });

/**
 * The rules a *kind* carries, before a document declares any of its own.
 *
 * `valueShape` for every kind — what it can hold at all — and, for `email`, the address rule the
 * control it draws already enforces. A field of that kind is judged twice, by the browser and by
 * this form, and two judges of one address must agree: without the rule here the browser blocked
 * submissions nothing in the form objected to.
 *
 * A document that also declares `validators: { email: true }` adds the same rule and the same
 * sentence, which the engine says once.
 */
export function kindValidators<T>(kind: MdyValueKind): ReadonlyArray<ValidatorFn<T>> {
  return kind === "email"
    ? [valueShape<T>(kind), email() as unknown as ValidatorFn<T>]
    : [valueShape<T>(kind)];
}

/** RegExp pattern validator */
export const pattern = (regex: RegExp, message = 'Invalid format'): ValidatorFn<string | null> =>
  withFacts((value) => {
    if (!value) return [];
    return regex.test(value) ? [] : [message];
    // `<input pattern>` is anchored and has no flags, so only a source without them can be offered;
    // a flagged expression stays a rule, which is where it was working already.
  }, regex.flags === "" ? { pattern: regex.source } : {}, { rule: "pattern", takes: ["pattern"] });

/** Numeric minimum. Empty passes — whether a field may be empty is `required`'s question. */
export const min = (minimum: number, message?: string): ValidatorFn<number | null> => {
  const fn = (value: number | null): readonly string[] => {
    if (value === null || value === undefined) return [];
    // A value that cannot be compared is not within any bound. Without this `NaN < minimum` is
    // false, so the rule passes a value it can say nothing about.
    if (Number.isNaN(value)) return [message ?? `Minimum value is ${minimum}`];
    return value < minimum
      ? [message ?? `Minimum value is ${minimum}`]
      : [];
  };
  return withFacts(fn, { min: minimum }, { rule: "min", takes: ["number"] });
};

/** Numeric maximum. Empty passes — whether a field may be empty is `required`'s question. */
export const max = (maximum: number, message?: string): ValidatorFn<number | null> => {
  const fn = (value: number | null): readonly string[] => {
    if (value === null || value === undefined) return [];
    if (Number.isNaN(value)) return [message ?? `Maximum value is ${maximum}`];
    return value > maximum
      ? [message ?? `Maximum value is ${maximum}`]
      : [];
  };
  return withFacts(fn, { max: maximum }, { rule: "max", takes: ["number"] });
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
  }, { step: 1 }, { rule: "integer", takes: [] });

/**
 * Whether a value is the option that was offered.
 *
 * `Object.is` is the whole answer for a primitive option and the wrong one for an object: a draft is
 * written as JSON and read back as JSON, so a user who picked `{ id: 1, label: "One" }`, left the
 * form and came back was told their own choice is not on the list — with nothing to do about it but
 * pick the same thing again. An option is "whatever the option list holds", which the value contract
 * states in those words, so an object option has to be recognised by what it is rather than by which
 * copy of it this is.
 *
 * Compared by structure, and only for the shapes JSON round-trips: plain objects, arrays, dates and
 * primitives. Anything else — a class instance, a Map, an option carrying a function — keeps
 * identity, because a copy of one is not a value this can claim to recognise.
 *
 * This does not weaken the guard it exists for. A scripted `set({ id: 3 })` is refused, and so is an
 * offered option with a member missing, a member of the wrong type, or a member added.
 */
function sameOption(offered: unknown, value: unknown, depth = 0): boolean {
  if (Object.is(offered, value)) return true;
  // A depth this reaches is a structure no option list has; refusing to recurse further reports "not
  // that option", which is the safe direction.
  if (depth > 8) return false;
  if (offered === null || value === null) return false;
  if (typeof offered !== "object" || typeof value !== "object") return false;

  if (offered instanceof Date || value instanceof Date) {
    return offered instanceof Date && value instanceof Date && offered.getTime() === value.getTime();
  }
  if (Array.isArray(offered) || Array.isArray(value)) {
    if (!Array.isArray(offered) || !Array.isArray(value) || offered.length !== value.length) return false;
    return offered.every((entry, index) => sameOption(entry, value[index], depth + 1));
  }
  if (!isPlainObject(offered) || !isPlainObject(value)) return false;

  const offeredKeys = Object.keys(offered);
  if (offeredKeys.length !== Object.keys(value).length) return false;
  return offeredKeys.every(
    (key) => Object.hasOwn(value, key) && sameOption(offered[key], value[key], depth + 1),
  );
}

/** An object carrying data rather than behaviour — what a document or a JSON draft can produce. */
function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/**
 * Option whitelist: the value must be one of `values`. This is the client-side anti-tampering guard
 * for option-based fields — a select offering "one"/"two" must not accept a scripted `set("three")`.
 * Empty values pass (pair with `required()` to mandate a choice). Remember client-side checks are
 * defense-in-depth: the server must re-validate (see docs/guides/security.md).
 *
 * An option is compared by what it is: a primitive by value, an object by its members. A draft is
 * written and read back as JSON, so an object option arrives as a different object holding the same
 * data, and identity would call a user's own saved choice tampering.
 */
/**
 * One option, as it appears in the sentence a person reads.
 *
 * `String({ id: 1 })` is `[object Object]`, so a list of object options told the person their choice
 * was not among two things it did not name. Object options are ordinary — a domain writes
 * `{ id, label }`, and the value contracts admit them — so the default sentence renders what the
 * option holds. A caller who has better words passes `message`, which is untouched.
 */
function optionText(option: unknown): string {
  if (option === null || typeof option !== "object") return String(option);
  try {
    return JSON.stringify(option) ?? String(option);
  } catch {
    // A cycle, or a value JSON refuses. Nothing readable is available, and saying so beats printing
    // a word the person cannot match against anything on screen.
    return String(option);
  }
}

/**
 * The whole sentence, including the case where there is no list to name.
 *
 * An empty list is legitimate — a select whose choices arrive later declares one — and a value
 * measured against it is refused, which is right. Naming the list then produced a sentence that
 * ended at its colon: the person was told their choice was not among a set nobody showed them.
 */
function optionsSentence(values: readonly unknown[], subject: string): string {
  if (values.length === 0) return "There are no choices to pick from.";
  return `${subject} must be one of: ${values.map(optionText).join(", ")}`;
}

/**
 * Not declared for a document, and that is the decision rather than an omission.
 *
 * A field already says which values it offers, in `options`, and a document that also declared
 * `oneOf` would carry the same list in two places — free to disagree with itself, with nothing to
 * say which one wins. `options` is the declarative form of this rule; this is the function behind
 * it, for a schema assembled in code.
 *
 * A test refuses a `rule` declaration here, so this reasoning cannot be undone by an edit that
 * looks like completeness.
 */
export const oneOf = (
  values: readonly unknown[],
  message?: string,
): ValidatorFn<unknown> =>
  (value) => {
    if (value === null || value === undefined || value === "") return [];
    return values.some((allowed) => sameOption(allowed, value))
      ? []
      : [message ?? optionsSentence(values, "Value")];
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
    return value.every((item) => values.some((allowed) => sameOption(allowed, item)))
      ? []
      : [message ?? optionsSentence(values, "Every value")];
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
