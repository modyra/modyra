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

/** Semantic state of a timepicker field widget. */
export interface MdyTimepickerFieldState {
  /** Committed field value, in `format` — null until a value has ever been confirmed. */
  readonly value: string | null;
  readonly format: MdyTimeFormat;
  /** Canonical 12h working copy while the picker is open — always populated (never blank), matching Angular's own "seed with the current time if empty" behavior. */
  readonly draft: ParsedTime;
  readonly open: boolean;
  readonly focusedField: "hour" | "minute";
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
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
