/**
 * Slider field widget types.
 *
 * A slider's filled track is drawn by the stylesheet from one custom property,
 * `MDY_CSS_PROPERTIES.control.sliderFill`, composed on the control itself. What percentage that
 * property carries is a contract question, not a renderer one: every adapter answered it inline
 * and they did not all give the same answer for a degenerate range.
 */

/**
 * How much of the track is filled, as a number between 0 and 100.
 *
 * A range with no width has no fill: `max <= min` answers `0` rather than dividing by a nudged
 * denominator, which is Angular's answer and the one that degrades visibly instead of arbitrarily.
 * A value that is absent or not a number fills to the minimum — a slider that has not been touched
 * yet sits at its start, and never paints `NaN%`. It takes `unknown` for that reason: a renderer
 * holds the field's value at its own width (`string | number`, often optional), and narrowing it
 * here is honest where a cast at each call site would only be assumed.
 */
export function sliderFillPercent(value: unknown, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const ratio = (value - min) / (max - min);
  return Math.min(100, Math.max(0, ratio * 100));
}
