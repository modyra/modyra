import { decimalPlaces } from "../value-controller.js";

/**
 * The number in a box a person types into, or nothing.
 *
 * Three renderers answered this three ways: one parsed the text, one read `valueAsNumber`, and one
 * did not convert at all and put the box's *string* in the model — where a numeric field's own
 * contract says it holds a number, so every rule about bounds was then judging text.
 *
 * Read from the text rather than from `valueAsNumber`, because that property is unimplemented in
 * some DOM implementations this library is asked to run in, and there it answers `NaN` for a box
 * that plainly holds a number — turning every typed digit into an empty field.
 *
 * Empty is nothing, text that is not a number is nothing, and a number is itself — never a value the
 * person did not write. `Number("")` is `0`, and a numeric field is nullable: clearing the box must
 * not supply a quantity nobody typed, which on the wire is an order line of zero, a price that is
 * free, a discount that is all of it.
 */
export function numberEntered(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/** The bounds and step a number box steps within; an absent or `null` member is undeclared. */
export interface MdyNumberStepRules {
  readonly min?: number | null;
  readonly max?: number | null;
  readonly step?: number | null;
}

/**
 * The number one press of a stepper leaves in the box, or `null` where the press changes nothing.
 *
 * A stepper button sits beside a box whose own arrow keys are the platform's `stepUp` and
 * `stepDown`, so the button answers exactly as they do; two answers in one control would be a field
 * that moves differently depending on which hand moved it. That means the HTML stepping algorithm:
 *
 * - the grid starts at `min`, or at `0` where none is declared, and has the step's spacing;
 * - a value on the grid moves one step; a value off it moves to the nearest grid value in the
 *   direction pressed, so `3` with `min: 1, step: 5` goes up to `6`, not `8`;
 * - past a bound, the value lands on the nearest grid value inside it;
 * - a press never moves the value against its direction, and a range with no grid value inside it
 *   moves nothing.
 *
 * The result carries only the decimals the step and the grid's start declare, as the platform's
 * decimal arithmetic does: `0.1` stepped twice is `0.2` and then `0.3`, never `0.30000000000000004`.
 * A step that is absent, zero or negative is `1`, the platform's default for a number box. An empty
 * box steps from `0`, and where `0` is out of range it takes the bound nearest to it, in either
 * direction.
 *
 * Where a browser's own arrow keys depart from the HTML algorithm, this follows the algorithm: a
 * value above `max` stepped down lands on the grid, not on an off-grid `max` the field would then
 * report as a step mismatch.
 */
export function numberStepped(
  from: number | null,
  direction: 1 | -1,
  rules: MdyNumberStepRules,
): number | null {
  const step = typeof rules.step === "number" && Number.isFinite(rules.step) && rules.step > 0 ? rules.step : 1;
  const min = typeof rules.min === "number" && Number.isFinite(rules.min) ? rules.min : null;
  const max = typeof rules.max === "number" && Number.isFinite(rules.max) ? rules.max : null;
  if (min !== null && max !== null && min > max) return null;

  const base = min ?? 0;
  const decimals = Math.max(decimalPlaces(step), decimalPlaces(base));
  const at = (index: number): number => Number((base + index * step).toFixed(decimals));
  // Grid indices are compared with a tolerance far below any step a person declares, so binary
  // representation error does not read as "off the grid".
  const tolerance = 1e-9;
  const lowest = min === null ? -Infinity : 0;
  const highest = max === null ? Infinity : Math.floor((max - base) / step + tolerance);
  if (lowest > highest) return null;

  const empty = typeof from !== "number" || !Number.isFinite(from);
  const before = empty ? 0 : from;
  const position = (before - base) / step;
  const nearest = Math.round(position);
  const onGrid = Math.abs(position - nearest) < tolerance;
  let index = onGrid ? nearest + direction : direction === 1 ? Math.ceil(position) : Math.floor(position);
  // An empty box whose zero lies outside the range enters it at the near end, whichever way it was
  // pressed: the person asked for a number, and the only one the range can give is that end.
  if (empty && (index < lowest || index > highest)) return at(index < lowest ? lowest : highest);
  if (index < lowest) index = lowest;
  if (index > highest) index = highest;

  const next = at(index);
  if ((direction === 1 && next < before) || (direction === -1 && next > before)) return null;
  return next;
}
