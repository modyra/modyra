/**
 * What a field of each kind holds, as contract data.
 *
 * The form engine, the validators and every renderer already agree on this implicitly — a
 * multiselect holds an array, a daterange holds two endpoints — and nothing wrote it down. An
 * implicit agreement cannot be checked, which is how a test fixture came to hand `""` to every kind
 * and a `daterange` receiving a string still reported itself conforming.
 *
 * This is dimension 6 of the widget specification, and it lives here rather than beside the DOM
 * contract because a value is not a rendering: `required`, {@link mdyEmptyValueFor} and the engine
 * that holds the value are all in this package.
 */
import { MDY_FIELD_KINDS } from "./field-kinds.js";

/** Every kind the contract describes a value for. */
export type MdyValueKind = (typeof MDY_FIELD_KINDS)[number];

/**
 * The runtime shape a value takes.
 *
 * Deliberately coarser than the TypeScript type: this answers "what did the renderer just put in the
 * field", which is a runtime question about a value that may have arrived from a network config, a
 * restored draft or a scripted `set()`.
 */
export type MdyValueShape =
  | "string"
  | "number"
  | "boolean"
  /** An option's value, which the field does not constrain further — the option list does. */
  | "option"
  /** Many of the above, in selection order. */
  | "option[]"
  /** `{ start, end }`, either endpoint nullable. */
  | "dateRange"
  | "file[]";

/**
 * When the field's value changes as against when the user is merely interacting.
 *
 * The answer is about the control the label names — the one a keyboard reaches and types into. A
 * kind may draw a second affordance beside it that writes as soon as it is used: a colour swatch
 * opens the platform's picker and each choice arrives immediately, while the hex box beside it holds
 * `#11` without writing anything, because `#11` is not a colour. One word per kind cannot say both,
 * and the word says what the *typed* control does, which is the one a person can leave half-finished.
 */
export type MdyValueCommit =
  /** Every interaction writes through: typing, dragging, toggling. */
  | "live"
  /** The field only changes on an explicit confirmation; interaction edits a draft. */
  | "confirm"
  /**
   * The field changes when what the user is building becomes a value at all.
   *
   * A range is the case: a start with no end is not a range, so choosing one writes nothing, and the
   * second choice writes both. There is nothing to confirm — no OK, no Cancel — and nothing is
   * written live either, so neither of the other two words is true about it. `completeRange()` is
   * the same statement from the value's side.
   */
  | "complete";

export interface MdyValueContract {
  readonly shape: MdyValueShape;
  /** Whether the value may be absent. A kind that cannot be empty is one `required` never rejects. */
  readonly nullable: boolean;
  readonly commit: MdyValueCommit;
  /**
   * Whether this kind's value is concealed wherever it is shown.
   *
   * The whole meaning of `password`: it holds a string exactly as `text` does, and the one thing
   * that makes it a password is that what is typed into it is not displayed. Said nowhere, that
   * difference was knowledge each adapter carried privately — and the failure mode of an adapter
   * that does not carry it is a password rendered in clear text.
   *
   * Distinct from a field's own `sensitive`, which an author declares about *this* field's value
   * (ADR 0089). This is a property of the kind, true before any form exists.
   */
  readonly concealed?: boolean;
}

const live = (shape: MdyValueShape, nullable: boolean): MdyValueContract =>
  Object.freeze({ shape, nullable, commit: "live" as const });

/**
 * One entry per kind, exhaustive by construction.
 *
 * `nullable` says whether the field may hold `null` — whether *absence* is one of its values. Eleven
 * kinds say no: `checkbox`, `colors`, `daterange`, `email`, `file`, `multiselect`, `password`,
 * `slider`, `text`, `textarea` and `toggle`. Each of them has an empty value that is a real value of
 * its type — `false`, `""`, `[]`, `{start: null, end: null}` — which is what
 * {@link mdyEmptyValueFor} answers from the other direction.
 *
 * **It does not say whether a `required` can fail.** That was the reading this comment invited and it
 * is wrong in both directions: `checkbox` and `toggle` are not nullable and their `required` refuses
 * `false`, which is the whole point of a consent field, and `text` refuses `""`. The one kind whose
 * `required` has nothing to refuse is `slider` — a thumb is always somewhere, so there is no state
 * for it to be empty in. Ask emptiness of `required`; ask `nullable` whether `null` is a value the
 * field may hold.
 */
export const MDY_VALUE_CONTRACTS: Readonly<Record<MdyValueKind, MdyValueContract>> = Object.freeze({
  text: live("string", false),
  textarea: live("string", false),
  email: live("string", false),
  password: Object.freeze({ ...live("string", false), concealed: true }),
  // The hex box is what the label names and what a keyboard types into, and it writes on blur or
  // Enter rather than per keystroke: `#11` is not a colour, and a field that took it would hold a
  // value nothing could show. The native swatch beside it writes as soon as it is used — one word
  // per kind, and it answers for the control a person can leave half-finished.
  colors: Object.freeze({ shape: "string" as const, nullable: false, commit: "confirm" as const }),
  number: live("number", true),
  // A thumb is always somewhere, so a slider always holds a number.
  slider: live("number", false),
  checkbox: live("boolean", false),
  toggle: live("boolean", false),
  select: live("option", true),
  radio: live("option", true),
  segmented: live("option", true),
  multiselect: live("option[]", false),
  datepicker: live("string", true),
  // The picker edits a draft on its dial and writes nothing until the user confirms, so an abandoned
  // picker leaves the field exactly as it found it.
  timepicker: Object.freeze({ shape: "string" as const, nullable: true, commit: "confirm" as const }),
  // Neither live nor confirm: the first endpoint writes nothing because a start with no end is not a
  // range, and the second writes both. There is no OK to press.
  daterange: Object.freeze({ shape: "dateRange" as const, nullable: false, commit: "complete" as const }),
  file: live("file[]", false),
});

/** Whether a value matches the shape its kind declares. */
export function matchesValueShape(shape: MdyValueShape, value: unknown): boolean {
  switch (shape) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    // An option's value is whatever the option list holds, so anything non-nullish satisfies the
    // shape. That the value is *one of the offered options* is a validator's question, and
    // `oneOf`/`eachOneOf` already answer it.
    case "option":
      return value !== null && value !== undefined;
    case "option[]":
      return Array.isArray(value);
    case "dateRange":
      return typeof value === "object" && value !== null && "start" in value && "end" in value;
    case "file[]":
      return Array.isArray(value);
  }
}

/**
 * Why a value does not belong in a field of this kind, or `null` if it does.
 *
 * Returns the reason rather than a boolean so a failure names what was wrong, which is the
 * difference between a check that reports a defect and one that only reports a colour.
 */
export function explainValueMismatch(kind: MdyValueKind, value: unknown): string | null {
  const contract = MDY_VALUE_CONTRACTS[kind];
  if (value === null || value === undefined) {
    return contract.nullable ? null : `${kind} cannot hold ${String(value)}`;
  }
  if (!matchesValueShape(contract.shape, value)) {
    return `${kind} holds ${contract.shape}, got ${typeof value === "object" ? JSON.stringify(value) : typeof value}`;
  }
  return contentMismatch(kind, value);
}

/**
 * Why a value of the right *shape* is still not one this kind can hold.
 *
 * Three kinds carry a string with a form: a date is ISO `yyyy-MM-dd`, a time is `HH:mm`, and a range
 * is two of the first. The shape check cannot see it — `string` is `string` — so a value arriving
 * from outside the control, a tampered draft above all, was taken whole: a datepicker restored from
 * storage held `"not a date at all"` and the form called itself valid and submittable.
 *
 * Said as a reason rather than refused here: the engine reports a shape it does not expect as a
 * verdict, which is what lets a field show what a person typed and say why it is wrong.
 */
function contentMismatch(kind: MdyValueKind, value: unknown): string | null {
  // The empty string is how absence is written wherever a value is a formatted string — `email` and
  // `pattern` both pass on it, and a document writing `initialValue: ""` for a date means "none".
  // Refusing it here would drop the field, which is a heavier answer than the mistake.
  if (value === "") return null;
  if (kind === "datepicker") {
    return isIsoDate(value) ? null : `${kind} holds an ISO date (yyyy-MM-dd), got ${JSON.stringify(value)}`;
  }
  if (kind === "timepicker") {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? null
      : `${kind} holds a time (HH:mm), got ${JSON.stringify(value)}`;
  }
  if (kind === "colors") {
    return isHexColor(value) ? null : `${kind} holds a hex colour (#rgb or #rrggbb), got ${JSON.stringify(value)}`;
  }
  if (kind === "daterange") {
    const range = value as { start?: unknown; end?: unknown };
    for (const end of ["start", "end"] as const) {
      const held = range[end];
      if (held === null || held === undefined || isIsoDate(held)) continue;
      return `${kind} holds ISO dates, and ${end} is ${JSON.stringify(held)}`;
    }
    return null;
  }
  return null;
}

/**
 * A colour this field can hold: `#rgb` or `#rrggbb`, in either case.
 *
 * Stated here because the field's own control already refuses anything else — typing `banana` leaves
 * the value as it was — and a rule that lives only on the typed path makes the verdict depend on
 * which door the value came through. A colour restored from a draft used to be taken whole: the
 * model held `banana`, the swatch fell back to black, and the form sent what the page never showed.
 */
function isHexColor(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value);
}

/** ISO `yyyy-MM-dd`, and a real date rather than a well-shaped impossible one. */
function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}
