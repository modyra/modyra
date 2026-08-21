/**
 * What a time field will accept, and what it does when the user goes past the end.
 *
 * A time picker has three numbers and every one of them has a range that depends on the format:
 * an hour on a 12-hour clock runs 1–12, the same hour on a 24-hour clock runs 0–23, and a minute is
 * 0–59 on both. Those bounds were previously spread across the renderers as literals and enforced
 * by returning `null` — which reads to the caller as "nothing happened", indistinguishable from a
 * no-op, so an out-of-range entry was silently dropped rather than shown to be wrong.
 *
 * Two behaviours, deliberately different, because the user means different things:
 *
 * - **Stepping wraps.** Arrow-key or spinner movement is sequential, so 12 + 1 is 1 and 0 − 1 is 23.
 *   A user holding the up arrow is scanning the range, not asserting a value, and stopping dead at
 *   the end is the wrong answer to what they are doing.
 * - **Typing is judged.** A typed `25` or `61` is a claim about a specific time, and the honest
 *   response is to say it is not one — not to clamp it to 23, which silently changes what was
 *   asked for, and not to ignore it, which leaves the field looking accepted.
 *
 * Both halves are stated here, once, so a renderer cannot enforce one of them and forget the other.
 */
import type { MdyTimeFormat } from "@modyra/core/datetime";
import { isOnStep, MDY_EVERY_TIME, type MdyTimeSteps } from "./time-granularity.js";

/** The three numbers a time is made of. */
export type MdyTimeField = "hour" | "minute";

export interface MdyTimeFieldBounds {
  /** Lowest accepted value, inclusive. */
  readonly min: number;
  /** Highest accepted value, inclusive. */
  readonly max: number;
  /** Distance between offered values. `1` is every one, which is what no granularity means. */
  readonly step: number;
}

/**
 * The range a field accepts in a given format.
 *
 * The hour is the only one that moves: `1–12` with a period beside it, `0–23` without. A minute is
 * 0–59 whatever the clock says, which is the rule most often lost when bounds live as literals next
 * to the hour's.
 */
export function timeFieldBounds(
  field: MdyTimeField,
  format: MdyTimeFormat,
  steps: MdyTimeSteps = MDY_EVERY_TIME,
): MdyTimeFieldBounds {
  if (field === "minute") return { min: 0, max: 59, step: steps.minuteStep };
  return format === "24h"
    ? { min: 0, max: 23, step: steps.hourStep }
    : { min: 1, max: 12, step: steps.hourStep };
}

/** Why a typed value was not accepted. */
export type MdyTimeRejection = "not-a-number" | "out-of-range" | "off-step";

export type MdyTimeEntry =
  | { readonly type: "accepted"; readonly value: number }
  | {
      readonly type: "rejected";
      readonly reason: MdyTimeRejection;
      readonly bounds: MdyTimeFieldBounds;
    };

/**
 * Judge a typed value against the field's range.
 *
 * Returns a rejection rather than a clamp or a `null`. A caller that clamps has answered a
 * different question from the one the user asked, and a caller that returns nothing leaves a field
 * that looks accepted holding a value it never took.
 */
export function acceptTimeField(
  field: MdyTimeField,
  format: MdyTimeFormat,
  raw: string | number,
  steps: MdyTimeSteps = MDY_EVERY_TIME,
): MdyTimeEntry {
  const bounds = timeFieldBounds(field, format, steps);
  const text = String(raw).trim();
  // `Number("")` is 0 and `Number(" 5 ")` is 5, so the emptiness and the shape are checked before
  // the value: an empty box is not a request for midnight.
  if (text.length === 0 || !/^\d{1,2}$/.test(text)) {
    return { type: "rejected", reason: "not-a-number", bounds };
  }
  const value = Number(text);
  if (value < bounds.min || value > bounds.max) {
    return { type: "rejected", reason: "out-of-range", bounds };
  }
  // A time this field does not offer is in range and still not one of its answers, and the two are
  // different sentences: "there is no 25 o'clock" and "this booking takes appointments every
  // quarter hour". Measured from the range's own start, so a 12-hour clock counting from 1 offers
  // its own hours rather than the 24-hour clock's.
  if (!isOnStep(value - bounds.min, bounds.step)) {
    return { type: "rejected", reason: "off-step", bounds };
  }
  return { type: "accepted", value };
}

/**
 * Move a field by `delta`, continuing at the other end rather than stopping.
 *
 * The arithmetic is done over the size of the range rather than over the raw number, so a 12-hour
 * hour wraps 12 → 1 while a 24-hour one wraps 23 → 0, from the same expression. A `current` outside
 * the range is brought inside by the same wrap rather than treated as an error: stepping is how a
 * user *leaves* a bad value, so it must not be the one operation that refuses to.
 */
/** The highest offered value below `size`, counting from 0 by `step`. */
function lastOffered(size: number, step: number): number {
  const by = step >= 1 ? step : 1;
  return Math.floor((size - 1) / by) * by;
}

/** The nearest offered value in the direction of travel, for a value that is not on one. */
function snapped(from: number, step: number, by: number): number {
  const by_ = step >= 1 ? step : 1;
  return by < 0 ? Math.floor(from / by_) * by_ : Math.ceil(from / by_) * by_;
}

export function stepTimeField(
  field: MdyTimeField,
  format: MdyTimeFormat,
  current: number,
  delta: number,
  steps: MdyTimeSteps = MDY_EVERY_TIME,
): number {
  const { min, max, step } = timeFieldBounds(field, format, steps);
  const size = max - min + 1;
  const by = Number.isFinite(delta) ? Math.round(delta) : 0;
  // A field holding nothing at all — an empty box read as a number, a parse that failed — enters the
  // range at the end the user is moving away from: up from nothing is the first hour, down from
  // nothing is the last. Arithmetic on a non-finite `current` produces `NaN`, which the caller stores
  // and the user then cannot step out of, so the one operation whose whole purpose is to leave a bad
  // value would be the one that preserves it.
  //
  // Entering at `min + by` instead would put the first press on the *second* value and leave the
  // first unreachable by the keyboard, which is the sort of thing only a guard written for the
  // arithmetic rather than for the user produces.
  if (!Number.isFinite(current)) return by < 0 ? lastOffered(size, step) + min : min;

  const from = Math.round(current) - min;
  // A value the field does not offer — chosen before the rule changed, or sent by a server that
  // does not share it — is left where it is until the user moves, and then the move lands on an
  // offered value in the direction they are going. Stepping is how a user *leaves* a value the
  // field will not take, so it must not be the operation that keeps them on it.
  const offset = isOnStep(from, step) ? from + by * step : snapped(from, step, by);
  // `%` keeps the sign of the dividend in JavaScript, so a downward step past the start needs the
  // extra turn to come back positive.
  const wrapped = (((offset % size) + size) % size);
  // Wrapping can land between offered values when the step does not divide the range — a 12-hour
  // clock stepping by 5 runs 1, 6, 11 and then round. The end of the range is where that shows, and
  // the answer is the last value actually on offer rather than the arithmetic's remainder.
  return (isOnStep(wrapped, step) ? wrapped : (by < 0 ? lastOffered(size, step) : 0)) + min;
}
