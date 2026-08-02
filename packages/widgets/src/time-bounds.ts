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
import type { MdyTimeFormat } from "@modyra/core/time-utils";

/** The three numbers a time is made of. */
export type MdyTimeField = "hour" | "minute";

export interface MdyTimeFieldBounds {
  /** Lowest accepted value, inclusive. */
  readonly min: number;
  /** Highest accepted value, inclusive. */
  readonly max: number;
}

/**
 * The range a field accepts in a given format.
 *
 * The hour is the only one that moves: `1–12` with a period beside it, `0–23` without. A minute is
 * 0–59 whatever the clock says, which is the rule most often lost when bounds live as literals next
 * to the hour's.
 */
export function timeFieldBounds(field: MdyTimeField, format: MdyTimeFormat): MdyTimeFieldBounds {
  if (field === "minute") return { min: 0, max: 59 };
  return format === "24h" ? { min: 0, max: 23 } : { min: 1, max: 12 };
}

/** Why a typed value was not accepted. */
export type MdyTimeRejection = "not-a-number" | "out-of-range";

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
): MdyTimeEntry {
  const bounds = timeFieldBounds(field, format);
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
export function stepTimeField(
  field: MdyTimeField,
  format: MdyTimeFormat,
  current: number,
  delta: number,
): number {
  const { min, max } = timeFieldBounds(field, format);
  const size = max - min + 1;
  const offset = Math.round(current) - min + Math.round(delta);
  // `%` keeps the sign of the dividend in JavaScript, so a downward step past the start needs the
  // extra turn to come back positive.
  return (((offset % size) + size) % size) + min;
}
