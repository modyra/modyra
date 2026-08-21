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
import { isOnStep, MDY_EVERY_TIME, type MdyTimeSteps } from "../time-granularity.js";
import { timeFieldBounds } from "../time-bounds.js";
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
  steps: MdyTimeSteps = MDY_EVERY_TIME,
): readonly MdyTimepickerDialNumber[] {
  // A face draws what the field accepts, judged by the same rule and from the same start. Measuring
  // the face from 0 while `acceptTimeField` measures from the range's own minimum is how a 12-hour
  // clock came to draw a 12 it would then refuse — the two halves of one rule, disagreeing, with
  // nothing able to notice because each is correct on its own terms.
  const { min, step } = timeFieldBounds(field, format, steps);
  const offered = (value: number): boolean => isOnStep(value - min, step);
  if (field === "hour") {
    const outer = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((hour) => offered(hour)).map((hour) =>
      Object.freeze({ value: hour, label: String(hour), index: hour, ring: "outer" as const }),
    );
    if (format === "12h") return Object.freeze(outer);
    // The 24-hour face: 1–12 outside, then 13–23 and 00 on the inner ring at the same positions.
    // `00` rather than `24`, because midnight is the hour a 24-hour clock actually names.
    const inner = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hour, position) => ({ hour, position })).filter(({ hour }) => offered(hour)).map(({ hour, position }) =>
      Object.freeze({
        value: hour,
        label: String(hour).padStart(2, "0"),
        // Midnight sits at the top, where 12 sits on the outer ring.
        index: position === 0 ? 12 : position,
        ring: dialRingOf("hour", hour, "24h"),
      }),
    );
    return Object.freeze([...outer, ...inner]);
  }
  return Object.freeze(
    Array.from({ length: 12 }, (_, position) => position).filter((position) => offered(position * 5)).map((position) => {
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

/** Where a number sits, in degrees clockwise from the top. */
export function dialNumberAngle(number: MdyTimepickerDialNumber): number {
  return (number.index % 12) * 30;
}

/**
 * Where a dragged pointer landed: the value, the angle it sits at, and which ring it is on.
 *
 * The angle is the **number's** angle, not the pointer's, so a renderer rests the hand on what was
 * chosen rather than under the finger. The ring is what lets it draw a shorter hand for the inner
 * one — at `hourStep: 3` the outer 3 and the inner 15 share a position, and without that difference
 * the two selections are indistinguishable on screen.
 */
export interface MdyTimepickerDialPick {
  readonly value: number;
  readonly angle: number;
  readonly ring: "outer" | "inner";
}

/**
 * The value a dragged pointer lands on: the nearest one the field **offers**.
 *
 * Offered is not the same set as drawn, and conflating them coarsens the dial. A minute face has
 * twelve positions and a minute field has sixty values, so an ungranulated picker draws 0, 5, 10 …
 * and still accepts every minute — the hand sits between two labels, which is what a clock does.
 * Landing only on drawn numbers would silently turn every picker in the library into a five-minute
 * one.
 *
 * What must hold instead is that a drag can only reach a value the field would accept, at any step.
 * Hours have as many values as positions, so for them the two sets coincide; minutes do not.
 *
 * A tie — an angle exactly between two offered values — goes **clockwise**, to the later of the two.
 * Arbitrary, but stated: an unstated tie-break is one the face and the keyboard can resolve
 * differently.
 *
 * Returns `null` only when the granularity offers this field nothing at all, which a validated one
 * never does.
 */
export function timepickerDialPick(
  angle: number,
  field: "hour" | "minute",
  format: MdyTimeFormat = "12h",
  ring: "outer" | "inner" = "outer",
  steps: MdyTimeSteps = MDY_EVERY_TIME,
): MdyTimepickerDialPick | null {
  const candidates: MdyTimepickerDialPick[] = [];
  if (field === "hour") {
    // Twelve positions, and which hour each names depends on the ring — the same direction is 3
    // outside and 15 inside. The drawn numbers already carry that, so they are the candidates.
    for (const number of timepickerDialNumbers("hour", format, steps)) {
      if (number.ring === ring || format !== "24h") {
        candidates.push({ value: number.value, angle: dialNumberAngle(number), ring: number.ring });
      }
    }
    // A granularity can thin a ring to nothing — `hourStep: 7` leaves one hour on the whole outer
    // ring — and a pointer over an empty ring still has to land somewhere it can see.
    if (candidates.length === 0) {
      for (const number of timepickerDialNumbers("hour", format, steps)) {
        candidates.push({ value: number.value, angle: dialNumberAngle(number), ring: number.ring });
      }
    }
  } else {
    const { min, max, step } = timeFieldBounds("minute", format, steps);
    for (let minute = min; minute <= max; minute += 1) {
      if (isOnStep(minute - min, step)) candidates.push({ value: minute, angle: minute * 6, ring: "outer" });
    }
  }
  if (candidates.length === 0) return null;

  const target = ((angle % 360) + 360) % 360;
  let best = candidates[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const apart = Math.abs(((target - candidate.angle + 540) % 360) - 180);
    // `<=` rather than `<`, and the candidates run clockwise, so a tie takes the later one.
    if (apart <= bestDistance) {
      bestDistance = apart;
      best = candidate;
    }
  }
  return best;
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

/**
 * The second hand: where the pointer is, when that is not where the value is.
 *
 * A dial that offers only some times has to snap, and snapping alone hides what it is doing — the
 * hand jumps to a number the finger is not on, and whether that was the rule or a missed press is
 * not something the screen says. So the chosen value keeps the hand it always had, and a translucent
 * one follows the pointer whenever the two are apart. The gap between them **is** the explanation.
 *
 * Nothing to show when they agree, which is every picker that offers every time: a ghost permanently
 * under the real hand would be a second thing to look at that never means anything.
 *
 * `within` is the tolerance in degrees, and it is the contract's rather than a renderer's for the
 * usual reason — three answers to "close enough" is three widgets. Half the angular gap between two
 * offered values is what it defaults to: the ghost appears exactly when the pointer is nearer some
 * other number than the one that was taken.
 */
export interface MdyTimepickerDialGhost {
  readonly angle: number;
  readonly ring: "outer" | "inner";
}

export function timepickerDialGhost(
  pointerAngle: number,
  pick: MdyTimepickerDialPick,
  options: { readonly ring?: "outer" | "inner"; readonly within?: number } = {},
): MdyTimepickerDialGhost | null {
  const at = ((pointerAngle % 360) + 360) % 360;
  const apart = Math.abs(((at - pick.angle + 540) % 360) - 180);
  const within = options.within ?? 0;
  if (!(apart > within)) return null;
  return { angle: at, ring: options.ring ?? pick.ring };
}

/**
 * How far off a number the pointer can be and still be **on** it, in degrees.
 *
 * Not half the gap to the next number. That was the first answer and it is a tautology: the pick is
 * *defined* as the nearest offered value, so the pointer is always within half a gap of it, and a
 * ghost that appears past half a gap never appears at all. Measured across three faces it was hidden
 * at every one of 360 angles, with every unit test of the parts still green.
 *
 * On the number means on the number. A digit is `MDY_TIMEPICKER_NUMBER_SIZE` wide, drawn at a radius
 * of `handLength` outside and `handLength × MDY_TIMEPICKER_INNER_RING` inside, so it subtends
 * `atan((size / 2) / radius)` either side of its own direction — about 11° out there and about 18°
 * further in, because a same-sized number covers more of a smaller circle.
 */
export function timepickerDialTolerance(
  ring: "outer" | "inner" = "outer",
  handLength = 0,
): number {
  if (!(handLength > 0)) return 0;
  const radius = ring === "inner" ? handLength * MDY_TIMEPICKER_INNER_RING : handLength;
  return (Math.atan((MDY_TIMEPICKER_NUMBER_SIZE / 2) / radius) * 180) / Math.PI;
}

/**
 * Which ring a value sits on. One predicate, so the face and the hand cannot disagree about it.
 *
 * Only a 24-hour face has two rings: midnight and 13–23 go inside, at the same twelve positions as
 * 12 and 1–11.
 */
export function dialRingOf(field: "hour" | "minute", value: number, format: MdyTimeFormat): "outer" | "inner" {
  if (field !== "hour" || format !== "24h") return "outer";
  return value === 0 || value >= 13 ? "inner" : "outer";
}

/**
 * Which ring the hand is currently pointing into.
 *
 * The hand is drawn shorter for the inner ring, and that is not decoration: a granularity can put
 * two hours at one position — with `hourStep: 3` the outer 3 and the inner 15 share a direction —
 * and without the difference in length the two selections are identical on screen. A person cannot
 * tell which they chose until they read the header.
 */
export function timepickerSelectedRing(
  field: "hour" | "minute",
  draft: ParsedTime,
  format: MdyTimeFormat = "12h",
): "outer" | "inner" {
  return dialRingOf(field, timepickerSelectedDialValue(field, draft, format), format);
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
/**
 * How far in the inner ring sits, as a fraction of the **hand's length**.
 *
 * The stylesheet draws it at `0.6` of `--tp-hand-length` and says why there; this is the same number
 * because the two have to agree. `INNER_RING_RADIUS` is the one value shared between the drawing and
 * the hit test, and a contract test holds it against the stylesheet — everything else about where
 * the rings land is measured rather than assumed.
 */
export const MDY_TIMEPICKER_INNER_RING = 0.6;

/**
 * How wide a number on the face is, in pixels.
 *
 * The stylesheet's `--tp-num-size`, which is also what `--tp-hand-length` subtracts half of to find
 * the radius the outer digits sit at. Published here for the same reason the ring fraction is: the
 * question "is the pointer on this number" is answered in the contract, and a renderer measuring the
 * box itself would be a second answer that drifts. `css-properties.spec.mjs` holds the two together.
 */
export const MDY_TIMEPICKER_NUMBER_SIZE = 40;

/**
 * How far either side of the inner ring's radius still counts as reaching for it, as a fraction of
 * the gap between the two painted radii.
 *
 * A fraction rather than an expression so that tightening it is one number. At `0.5` the band is the
 * whole gap — inner from the midpoint inwards to as far below the inner radius — which is where the
 * two rings' digits abut, and where a person feels the inner ring beginning too early has nothing
 * left to tune. Lower it and the band closes around the inner digits.
 */
export const MDY_TIMEPICKER_RING_BAND = 0.5;

/**
 * Which ring of the face a pointer landed on.
 *
 * A 12-hour face has one ring and always answers `"outer"`. A 24-hour face has two at the same twelve
 * positions, so the angle alone cannot name the hour — asked without this, half the numbers the face
 * draws had no way to be chosen.
 *
 * `handLength` is the radius the outer digits are drawn at, which the stylesheet computes as
 * `dialSize / 2 − numSize / 2 − 8px` and publishes as `--tp-hand-length`. It is passed in rather
 * than derived because those three numbers belong to the drawing: a copy of them here is a copy that
 * drifts, and the first version of this function compared a fraction of the *hand* against a
 * fraction of the *dial radius* — two different lengths — which put the boundary 2.4px outside the
 * outer digits. Every point on the face read as `inner`, including the outer numbers themselves.
 *
 * The inner ring is a **band around where its numbers are drawn**, not everything closer than the
 * outer ones. Reading the whole disc below the midpoint as inner makes the empty middle of the face
 * — most of its area — answer with an hour whose number is nowhere near the pointer, and the hand
 * jumps short for a press the user aimed at the outer ring. The band is as wide as the gap between
 * the two painted radii, centred on the inner one, so a press has to be near the digits to claim
 * them and anything else belongs to the ring that is actually drawn out there.
 *
 * `field` is here because only the hour has two rings. A minute face draws one, and a rule that
 * answered `"inner"` for a press near the centre of it shortened the hand for a ring that does not
 * exist.
 */
export function timepickerDialRing(
  face: { readonly width: number; readonly height: number; readonly left: number; readonly top: number },
  clientX: number,
  clientY: number,
  format: MdyTimeFormat,
  handLength: number,
  field: "hour" | "minute" = "hour",
): "outer" | "inner" {
  if (field !== "hour" || format !== "24h") return "outer";
  if (!(handLength > 0)) return "outer";
  const dx = clientX - (face.left + face.width / 2);
  const dy = clientY - (face.top + face.height / 2);
  const reach = Math.sqrt(dx * dx + dy * dy);
  // Where the two rings are painted, and how far from the inner one still counts as reaching for it.
  const inner = handLength * MDY_TIMEPICKER_INNER_RING;
  const reachOfBand = (handLength - inner) * MDY_TIMEPICKER_RING_BAND;
  return Math.abs(reach - inner) <= reachOfBand ? "inner" : "outer";
}

export function timepickerDialKeyIntent(
  key: string,
  field: "hour" | "minute",
  format: MdyTimeFormat,
  current: number,
): MdyTimepickerDialKeyResult | null {
  // Every surface of a 24-hour picker speaks 0–23 — this one, the face, the segment bounds, what a
  // typed entry is accepted as — and the working copy is canonically 1–12. The controller converts:
  // `set-hour` and `set-from-angle` take the hour in the picker's own format and derive the half of
  // the day from it. A host sends what its face shows and nothing else.
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
