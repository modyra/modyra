/**
 * The dial: where its numbers sit, which one is chosen, and what a key does to it.
 *
 * Geometry, a keyboard policy and an ARIA projection — none of which is a type. They were in a file
 * called `timepicker-field-types.ts`, which is what a name does when a module grows past it: the one
 * `*-types.ts` in this folder holding two hundred lines of behaviour, and the only place a reader
 * looking for the dial's rules would not think to open.
 */
import { to24Hour } from "@modyra/core/datetime";
import type { MdyTimeFormat, ParsedTime } from "@modyra/core/datetime";
export interface MdyTimepickerDialNumber {
  readonly value: number;
  readonly label: string;
  readonly index: number;
  /**
   * Which ring the number sits on. A face has twelve positions, and 24-hour time has twenty-four
   * hours, so the second twelve go on an inner ring at the same twelve positions — which is what a
   * clock has always done and what Material's own 24-hour dial does.
   *
   * `"outer"` for every number on a 12-hour face and for 1–12 on a 24-hour one; `"inner"` for
   * 13–23 and for midnight.
   */
  readonly ring: "outer" | "inner";
}

/**
 * The numbers on the face for the field being picked.
 *
 * The hours a face offers are the hours the format has: 1–12 with an AM/PM toggle beside them, or
 * 0–23 with no toggle at all. It used to always answer 1–12, so a 24-hour picker showed a face on
 * which 14:00 could not be pointed at — the value was reachable by typing and by dragging, and not
 * by the control that exists to pick it. **A time keeps its formalism on screen as well as in its
 * value**: a face that offers thirteen hours in a twelve-hour clock, or twelve in a twenty-four
 * hour one, is telling the user something untrue about what they are editing.
 */
export function timepickerDialNumbers(
  field: "hour" | "minute",
  format: MdyTimeFormat = "12h",
): readonly MdyTimepickerDialNumber[] {
  if (field === "hour") {
    const outer = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) =>
      Object.freeze({ value: hour, label: String(hour), index: hour, ring: "outer" as const }),
    );
    if (format === "12h") return Object.freeze(outer);
    // The 24-hour face: 1–12 outside, then 13–23 and 00 on the inner ring at the same positions.
    // `00` rather than `24`, because midnight is the hour a 24-hour clock actually names.
    const inner = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hour, position) =>
      Object.freeze({
        value: hour,
        label: String(hour).padStart(2, "0"),
        // Midnight sits at the top, where 12 sits on the outer ring.
        index: position === 0 ? 12 : position,
        ring: "inner" as const,
      }),
    );
    return Object.freeze([...outer, ...inner]);
  }
  return Object.freeze(
    Array.from({ length: 12 }, (_, position) => {
      const minute = position * 5;
      return Object.freeze({
        value: minute,
        label: String(minute).padStart(2, "0"),
        // Minute 0 is at the top of the face, which is position 12.
        index: position === 0 ? 12 : position,
        ring: "outer" as const,
      });
    }),
  );
}

/**
 * Which number on the face is the selected one.
 *
 * Minutes are shown in fives, so a draft of 07 marks the 05 that is nearest to it rather than
 * marking nothing at all.
 *
 * **In the units the face shows.** The draft holds hours as 1–12 with a period whatever the format,
 * and a 24-hour face is numbered 0–23 — so answering the draft's hour marked `2` while the user was
 * looking at `14`. The face's numbers and the face's mark have to be decided by the same rule, or
 * they will eventually disagree; this is that rule, and `timepickerDialNumbers` is its other half.
 */
export function timepickerSelectedDialValue(
  field: "hour" | "minute",
  draft: ParsedTime,
  format: MdyTimeFormat = "12h",
): number {
  if (field === "minute") return (Math.round(draft.minute / 5) * 5) % 60;
  return format === "24h" ? to24Hour(draft) : draft.hour;
}

/** What a key does to the number the dial is pointing at. */
export interface MdyTimepickerDialKeyResult {
  /** The value the field takes, in the units the face shows. */
  readonly value: number;
  /** Which field it belongs to, so a host applies it without re-deriving anything. */
  readonly field: "hour" | "minute";
}

/**
 * The keyboard on the clock face.
 *
 * A dial is a control and had none: it listened for `mousedown` and `touchstart` and nothing else,
 * so the clock could only be operated by pointer. Everything on it was reachable by *dragging* a
 * hand around a circle, which is the one gesture a keyboard cannot make and a screen reader cannot
 * describe.
 *
 * The policy, once, here:
 *
 * - **Right/Up** steps forward, **Left/Down** back. Up is forward because the hand sweeps clockwise;
 *   a keyboard user turning the hand should feel the same direction the pointer drags.
 * - **Home/End** go to the first and last value the face offers — which depends on the format, and
 *   is exactly the rule this function exists to hold in one place.
 * - **PageUp/PageDown** move minutes by the five the face is marked in, and hours by three, so a
 *   quarter of the dial is one keystroke.
 * - Every result **wraps** rather than clamping. A clock is a ring: 23 then 00, 59 then 00, 12 then
 *   1. Clamping at the end of a circle is the one behaviour a dial cannot justify.
 *
 * And the range is the format's: hours run **1–12 with a period beside them, or 0–23 with none**.
 * Never thirteen hours on a twelve-hour clock, never a stray AM on a twenty-four hour one.
 *
 * Returns `null` for a key the dial does not claim, so a host can let it through.
 */
export function timepickerDialKeyIntent(
  key: string,
  field: "hour" | "minute",
  format: MdyTimeFormat,
  current: number,
): MdyTimepickerDialKeyResult | null {
  // Hours are held 1–12 in the draft whatever the format; a 24-hour face names 0–23, and the host
  // converts at the boundary exactly as it does for the typed input.
  const min = field === "minute" ? 0 : format === "24h" ? 0 : 1;
  const max = field === "minute" ? 59 : format === "24h" ? 23 : 12;
  const span = max - min + 1;
  const page = field === "minute" ? 5 : 3;

  const wrap = (value: number): MdyTimepickerDialKeyResult => ({
    field,
    value: ((((value - min) % span) + span) % span) + min,
  });

  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return wrap(current + 1);
    case "ArrowLeft":
    case "ArrowDown":
      return wrap(current - 1);
    case "PageUp":
      return wrap(current + page);
    case "PageDown":
      return wrap(current - page);
    case "Home":
      return { field, value: min };
    case "End":
      return { field, value: max };
    default:
      return null;
  }
}

/**
 * What a screen reader is told about the hand's current position.
 *
 * A dial is a slider around a circle, and `role="slider"` is what says so — but only with the three
 * values that make a slider mean anything. Without them the face was a `<div>` of `<div>`s: no role,
 * no value, no name, and nothing at all to a screen reader. The bounds come from the same rule the
 * keyboard follows, so what is announced and what the arrows do cannot drift apart.
 */
export function timepickerDialAria(
  field: "hour" | "minute",
  format: MdyTimeFormat,
  current: number,
): {
  readonly role: "slider";
  readonly valueMin: number;
  readonly valueMax: number;
  readonly valueNow: number;
  readonly valueText: string;
} {
  const min = field === "minute" ? 0 : format === "24h" ? 0 : 1;
  const max = field === "minute" ? 59 : format === "24h" ? 23 : 12;
  return {
    role: "slider",
    valueMin: min,
    valueMax: max,
    valueNow: current,
    valueText: field === "minute" ? `${String(current).padStart(2, "0")} minutes` : `${current} hours`,
  };
}

/** Semantic state of a timepicker field widget. */
