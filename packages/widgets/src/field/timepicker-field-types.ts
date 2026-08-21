/**
 * Timepicker field widget types.
 *
 * The committed value is a formatted time string in the configured `format` ("12h"/"24h"). The draft
 * held while editing is always canonical 12h `ParsedTime` (`@modyra/core/datetime`), converted at
 * the boundary by `parseAnyTime` and `formatTimeAs`, so the dial has one representation to move
 * through whatever the field displays. Editing is draft/commit: nothing reaches the field until
 * `"confirm"`.
 *
 * The angle maths (`pointerAngle`, `angleToHour`, `angleToMinute`, `hourToAngle`, `minuteToAngle`)
 * is pure and lives in `@modyra/core/datetime`. The `"set-from-angle"` intent calls into it, so a
 * host building a drag-dial gets the snapping without reimplementing it — but the controller owns no
 * pointer or DOM listeners, which stays the host's job as it does for every controller here.
 */
import type { MdyInteractivity } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";
import type { MdyTimeFormat, ParsedTime } from "@modyra/core/datetime";
import type { MdyTimeGranularity } from "../time-granularity.js";

export interface MdyTimepickerFieldControllerOptions {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle; value is a formatted time string or null. */
  readonly handle: MdyFieldHandle<string | null>;
  /** Display and value format. Defaults to "12h". */
  readonly format?: MdyTimeFormat;
  /**
   * Which times this field offers. Absent means every one.
   *
   * Every route into the value obeys it — the face, the arrows, typing and a dragged pointer — and
   * a value already off it is kept and reported rather than rounded.
   */
  readonly granularity?: MdyTimeGranularity;
  /**
   * How the controller waits, so a test can hold the clock and a host can own the timer.
   *
   * The dial hands the hour over to the minute after a moment, and *when* belongs to whoever owns
   * `focusedField` — which is this controller. A renderer that scheduled it instead is a renderer
   * deciding when the field changed, which is how three of them came to answer 0ms, 200ms and 300ms.
   *
   * A seam rather than a bare `setTimeout` for the same reason `reactivity` is one: a fake clock
   * makes the handover assertable without sleeping, and teardown cancels through the same door.
   */
  readonly schedule?: (run: () => void, afterMs: number) => () => void;
  /**
   * What the popup shows when it opens. Defaults to the number fields.
   *
   * The dial is the slower way to reach a precise time and the faster way to reach an approximate
   * one, and which of those a person is doing belongs to the host rather than to this controller.
   * Whichever is configured, opening returns to it: where the last session left the popup is not
   * where the next one should resume.
   */
  readonly viewMode?: MdyTimepickerViewMode;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
  /**
   * Reads typed text as a `HH:mm` time, or answers null when it cannot.
   *
   * A dependency because the reading is locale-aware and the locale belongs to the host. Without
   * one, a typed entry is left alone.
   */
  readonly parseEntry?: (text: string) => string | null;
  /**
   * Reads one number a person typed into a segment, or answers null when the text is not one.
   *
   * A second reading rather than a second answer: `parseEntry` reads a whole time in the host's
   * notation — separator, ordering, AM/PM — and a segment is one bare numeral with none of that
   * around it. A host that localises supplies both, in one place.
   *
   * It exists because the box was reading `[0-9]` itself while the field beside it went through a
   * host-supplied reader, so the same numerals were accepted when the whole time was typed and
   * refused when typed into a box. This package cannot know what a numeral is anywhere, which is why
   * the reading is a dependency — and a second door that decides for itself defeats that silently.
   *
   * Without one, the segments read the digits every locale shares.
   */
  readonly parseSegment?: (text: string) => number | null;
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

export interface MdyTimepickerFieldState {
  /** Committed field value, in `format` — null until a value has ever been confirmed. */
  readonly value: string | null;
  readonly format: MdyTimeFormat;
  /** Canonical 12h working copy while the picker is open. Always populated: an empty field seeds it
   * with the current time, so the dial always has a hand to move. */
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
  /**
   * What the user may do. Ask it through `blocksValueChange`/`blocksFocus` rather than comparing
   * strings — the point of the union is that no call site invents its own combination again.
   */
  readonly interactivity: MdyInteractivity;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
  /**
   * What the person typed, while it is not a time this field can hold.
   *
   * A control renders this in place of the formatted value, so an entry that could not be read stays
   * where it can be corrected. `14:30` is the case this exists for: it is how most of the world
   * writes a time, a 12-hour control cannot read it, and erasing it left nothing to correct and no
   * way to learn why.
   */
  readonly entryText: string | null;
  /**
   * What the control shows: the outstanding entry, or the held time written in the field's format.
   *
   * The value itself is canonical `HH:mm`, which is what the value contract declares and what a
   * payload carries. Which notation a person reads is the field's own — a twelve-hour picker shows
   * `02:30 PM` — and a renderer that painted the value directly showed a twenty-four-hour time on a
   * twelve-hour control.
   */
  readonly display: string;
  /** Whether the outstanding entry could not be read — the half a control shows a verdict for. */
  readonly entryUnreadable: boolean;
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
  | {
    readonly type: "set-from-angle";
    readonly field: "hour" | "minute";
    readonly angle: number;
    /**
     * Which ring of the face was touched. Absent means the outer one, which is the only ring a
     * 12-hour face has — so a caller written before the 24-hour face existed keeps working.
     *
     * The angle alone cannot name the hour on a two-ring face: the same direction is 3 outside and
     * 15 inside, and half the numbers the face draws had no way to be asked for.
     */
    readonly ring?: "outer" | "inner";
  }
  | { readonly type: "focus-field"; readonly field: "hour" | "minute" }
  | { readonly type: "set-view-mode"; readonly mode: MdyTimepickerViewMode }
  /** The person typed something and left the control; the text is judged rather than parsed here. */
  | { readonly type: "type"; readonly text: string }
  /**
   * What a person has typed into one of the number boxes, as they typed it.
   *
   * Reported rather than parsed. Each renderer used to read its own box and hand over a number, so
   * each one decided what a half-typed value was — one padded after every keystroke and two
   * reformatted the character away — and each read `[0-9]` while the field beside it went through a
   * host-supplied reader.
   */
  | { readonly type: "type-segment"; readonly field: "hour" | "minute"; readonly text: string }
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
