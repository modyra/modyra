/**
 * Timepicker field widget types. Modeled on Angular's real, working
 * `MdyTimepickerComponent`/`MdyTimepickerClockComponent`
 * (packages/angular/src/lib/renderers/timepicker): the committed field
 * value is a single formatted time string in the configured `format`
 * ("12h"/"24h"), but — matching Angular's own component exactly — the
 * *draft* model while editing is always canonical 12h `ParsedTime`
 * (`@modyra/core/time-utils`), converted at the boundary via
 * `parseAnyTime`/`formatTimeAs`. Editing is draft/commit, same as
 * Angular's clock: nothing reaches the field until `"confirm"`.
 *
 * The dial-drag/angle math itself (`pointerAngle`, `angleToHour`,
 * `angleToMinute`, `hourToAngle`, `minuteToAngle`) already lives, pure and
 * portable, in `@modyra/core/time-utils` — this controller exposes a
 * `"set-from-angle"` intent that calls straight into it, so a host
 * building a drag-dial doesn't need to duplicate the snapping logic, but
 * the controller itself owns no pointer/DOM listeners (that stays the
 * host's job, same division of labor as every other controller here).
 */
import type { MdyFieldHandle } from "@modyra/core";
import type { MdyTimeFormat, ParsedTime } from "@modyra/core/time-utils";

export interface MdyTimepickerFieldControllerOptions {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle; value is a formatted time string or null. */
  readonly handle: MdyFieldHandle<string | null>;
  /** Display/value format — defaults to "12h", matching Angular's own default. */
  readonly format?: MdyTimeFormat;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
}

/** The clock face, or the pair of number fields. */
export type MdyTimepickerViewMode = "dial" | "input";

/**
 * One number on the clock face.
 *
 * `index` is the position on the dial — 1 at one o'clock, round to 12 at the top — which is what a
 * renderer sets as `--index` for the foundation to place it by. It is not the value: on the minute
 * face, 0 sits at position 12 and 5 at position 1. Working that out is exactly the kind of thing
 * three renderers would each get slightly differently.
 */
export interface MdyTimepickerDialNumber {
  readonly value: number;
  readonly label: string;
  readonly index: number;
}

/**
 * The numbers on the face for the field being picked: the twelve hours, or the minutes in fives.
 */
export function timepickerDialNumbers(field: "hour" | "minute"): readonly MdyTimepickerDialNumber[] {
  if (field === "hour") {
    return Object.freeze(
      [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) =>
        Object.freeze({ value: hour, label: String(hour), index: hour }),
      ),
    );
  }
  return Object.freeze(
    Array.from({ length: 12 }, (_, position) => {
      const minute = position * 5;
      return Object.freeze({
        value: minute,
        label: String(minute).padStart(2, "0"),
        // Minute 0 is at the top of the face, which is position 12.
        index: position === 0 ? 12 : position,
      });
    }),
  );
}

/**
 * Which number on the face is the selected one.
 *
 * Minutes are shown in fives, so a draft of 07 marks the 05 that is nearest to it rather than
 * marking nothing at all.
 */
export function timepickerSelectedDialValue(field: "hour" | "minute", draft: ParsedTime): number {
  return field === "hour" ? draft.hour : (Math.round(draft.minute / 5) * 5) % 60;
}

/** Semantic state of a timepicker field widget. */
export interface MdyTimepickerFieldState {
  /** Committed field value, in `format` — null until a value has ever been confirmed. */
  readonly value: string | null;
  readonly format: MdyTimeFormat;
  /** Canonical 12h working copy while the picker is open — always populated (never blank), matching Angular's own "seed with the current time if empty" behavior. */
  readonly draft: ParsedTime;
  readonly open: boolean;
  readonly focusedField: "hour" | "minute";
  /**
   * Which face the picker is showing: the clock, or the two number fields.
   *
   * Part of the state rather than of a renderer, because it decides what the popup contains and
   * how tall it is — a host that kept it privately would be deciding the widget's anatomy, and the
   * three renderers would disagree about what a timepicker is.
   */
  readonly viewMode: MdyTimepickerViewMode;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

/** User/host intent for a timepicker field widget. */
export type MdyTimepickerFieldIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" }
  | { readonly type: "set-hour"; readonly hour: number }
  | { readonly type: "set-minute"; readonly minute: number }
  | { readonly type: "set-period"; readonly period: "AM" | "PM" }
  | { readonly type: "set-from-angle"; readonly field: "hour" | "minute"; readonly angle: number }
  | { readonly type: "focus-field"; readonly field: "hour" | "minute" }
  | { readonly type: "set-view-mode"; readonly mode: MdyTimepickerViewMode }
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
