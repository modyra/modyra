/**
 * Built-in pure validator functions — implemented once in the
 * framework-agnostic engine (`@modyra/core`) and re-exported here so the
 * Angular package keeps a single import surface. All validators are pure:
 * they receive a value and return an array of error strings (empty = valid).
 *
 * Compose multiple validators with `compose()`; build cross-field rules
 * with `crossField()`. `MDY_MARKS_REQUIRED` is the marker `mdyForm()` reads
 * to drive a field's `required` signal (aria-required) without a separate
 * schema flag.
 */
export {
  compose,
  composeFirst,
  crossField,
  email,
  max,
  maxLength,
  MDY_MARKS_REQUIRED,
  min,
  minLength,
  pattern,
  required,
} from "@modyra/core";
