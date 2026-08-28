/**
 * The questions a part's `presentWhen` asks, answered once.
 *
 * A condition with no way to decide it is a declaration each renderer interprets for itself, and the
 * interpretations diverge in the direction nobody measures: `valueIsPresent` meant one thing where
 * chips are drawn and another where they are not, for as long as nothing here answered it.
 *
 * Each takes the narrowest input that decides it rather than a widget state, because a resolver that
 * takes everything is a resolver a caller cannot use without holding everything. ADR 0169 states
 * which conditions owe an answer and which do not: `documentDeclaresIt`, `kindOffersIt` and
 * `pointerIsOnAValue` are decided by facts the renderer already holds, and a function over them would
 * put a call between a consumer and something in their hand.
 */
import { MDY_VALUE_CONTRACTS, type MdyInteractivity } from "@modyra/core";
import type { MdyWidgetKind } from "./catalog/kinds.js";
import { blocksValueChange } from "./interactivity.js";

/**
 * Whether a kind's value holds anything.
 *
 * The emptiness of a value is the kind's, not the language's, and the kind declares it: `nullable`
 * separates a number field whose empty is `null` from a slider whose empty is where it starts, and
 * the shape separates a list from the single value it holds. `Boolean(value)` gets both of those
 * wrong, and three renderers asking it separately get them wrong in three ways — which is how this
 * condition came to mean one thing where chips are drawn and another where they are not.
 *
 * Derived from `MDY_VALUE_CONTRACTS` rather than from a table of empties, so a kind added to the
 * catalogue is answered without an edit here. Three kinds declare a part under this condition today —
 * a nullable single value and two lists — and the derivation covers every shape rather than those
 * three, because the fourth kind to declare it should not have to find this function first.
 */
export function valueIsPresent(kind: MdyWidgetKind, value: unknown): boolean {
  const declared = MDY_VALUE_CONTRACTS[kind];
  // A kind the value contract does not know: answered from the value alone, and the check beside this
  // asserts there is no such kind, so this is the branch that stops an unknown kind throwing rather
  // than a second rule.
  if (declared === undefined) return value !== null && value !== undefined && value !== "";

  if (value === null || value === undefined) return false;
  // Nullable means the empty *is* absence, so anything else present. A number field at `0` holds a
  // number somebody typed.
  if (declared.nullable) return true;

  if (declared.shape.endsWith("[]")) return Array.isArray(value) && value.length > 0;
  if (declared.shape === "string") return String(value).length > 0;
  // A checkbox that says no has been answered in one sense and holds this kind's empty in another.
  // The contract's answer is the second: `false` is where it starts, and a part drawn when there is
  // a value would be drawn on a form nobody has touched.
  if (declared.shape === "boolean") return value === true;
  // Not nullable and numeric: the empty is where the control starts, which is its floor, and this
  // function is not handed one. No kind of that shape declares a part under this condition; the
  // check beside this fails if one ever does, rather than this guessing at zero.
  if (declared.shape === "number") return true;
  if (declared.shape === "dateRange") {
    const ends = Object.values(value as Record<string, unknown>);
    return ends.some((end) => end !== null && end !== undefined && end !== "");
  }
  return true;
}

/** The other side, named because a part declares it: a placeholder is present when the value is not. */
export function valueIsAbsent(kind: MdyWidgetKind, value: unknown): boolean {
  return !valueIsPresent(kind, value);
}

/**
 * Whether the required marker belongs on the page.
 *
 * Not `handle.required()` alone. A field out of play cannot be filled in, so a marker on it asks for
 * something that cannot be given — and the same asterisk that means "you must" on a live field means
 * nothing at all on a disabled one, which is worse than absent because it still reads as a demand.
 */
export function fieldIsRequired(field: {
  readonly required: boolean;
  readonly interactivity: MdyInteractivity;
}): boolean {
  return field.required && !blocksValueChange(field.interactivity);
}

/** Whether an undo is on offer: a destructive act happened and has not been withdrawn. */
export function undoIsOnOffer(state: { readonly wayBack?: unknown }): boolean {
  return state.wayBack !== null && state.wayBack !== undefined;
}

/** Whether the view a part belongs to is the one showing — a calendar draws one of days, months, years. */
export function viewIsActive(state: { readonly viewMode?: string }, view: string): boolean {
  return state.viewMode === view;
}

/**
 * Whether the last attempt to put something in was refused.
 *
 * A refusal has to be visible or it did not happen: a file turned away for its size or its type
 * leaves the value exactly as it was, so the value cannot say that anything occurred.
 */
export function inputWasRefused(state: { readonly rejected?: readonly unknown[] }): boolean {
  return (state.rejected?.length ?? 0) > 0;
}

/**
 * Whether the widget is waiting on something.
 *
 * Two facts and one question: a validator that has not answered yet, and a list of options still
 * arriving. A part that says "wait" is right for either, and a renderer asking them separately shows
 * the spinner for one of the two reasons it exists.
 */
export function workIsInFlight(state: {
  readonly pending?: boolean;
  readonly loading?: boolean;
}): boolean {
  return state.pending === true || state.loading === true;
}
