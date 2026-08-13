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

/** When the field's value changes as against when the user is merely interacting. */
export type MdyValueCommit =
  /** Every interaction writes through: typing, dragging, toggling. */
  | "live"
  /** The field only changes on an explicit confirmation; interaction edits a draft. */
  | "confirm";

export interface MdyValueContract {
  readonly shape: MdyValueShape;
  /** Whether the value may be absent. A kind that cannot be empty is one `required` never rejects. */
  readonly nullable: boolean;
  readonly commit: MdyValueCommit;
}

const live = (shape: MdyValueShape, nullable: boolean): MdyValueContract =>
  Object.freeze({ shape, nullable, commit: "live" as const });

/**
 * One entry per kind, exhaustive by construction.
 *
 * `nullable` is the half that matters most: it is the difference between a field that can be empty
 * and one that cannot, and therefore between a `required` that can fail and one that cannot. The two
 * kinds that are not nullable — `slider` and the booleans — are the two whose empty value is a real
 * one, and {@link mdyEmptyValueFor} says the same thing from the other direction.
 */
export const MDY_VALUE_CONTRACTS: Readonly<Record<MdyValueKind, MdyValueContract>> = Object.freeze({
  text: live("string", false),
  textarea: live("string", false),
  email: live("string", false),
  password: live("string", false),
  colors: live("string", false),
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
  daterange: live("dateRange", false),
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
  return null;
}
