/**
 * Slider field widget types.
 *
 * A slider's filled track is drawn by the stylesheet from one custom property,
 * `MDY_CSS_PROPERTIES.control.sliderFill`, composed on the control itself. How far along the value
 * sits is a contract question, not a renderer one: every adapter answered it inline and they did
 * not all give the same answer for a degenerate range.
 */

/**
 * How far along the track the value sits, as a ratio between 0 and 1.
 *
 * A ratio rather than a percentage because the stylesheet cannot use a percentage here. The filled
 * part must stop under the handle's centre, which travels from `thumb/2` to `100% - thumb/2`, so
 * the stop is `thumb/2 + ratio * (100% - thumb)` — and `calc()` can multiply a length by a number
 * but cannot divide by a percentage to get that number back out of one.
 *
 * A range with no width has no fill: `max <= min` answers `0` rather than dividing by a nudged
 * denominator: an empty range degrades visibly instead of arbitrarily.
 * A value that is absent or not a number fills to the minimum — a slider that has not been touched
 * yet sits at its start, and never paints `NaN`. It takes `unknown` for that reason: a renderer
 * holds the field's value at its own width (`string | number`, often optional), and narrowing it
 * here is honest where a cast at each call site would only be assumed.
 */
export function sliderFillRatio(value: unknown, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
