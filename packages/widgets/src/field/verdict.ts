/**
 * Whether a field shows a verdict at all.
 *
 * A field the form is not asking about — disabled by a binding, or inside a section a condition has
 * closed — is **not validated by the form**: `form.state.valid()` ignores it. Painting it as failing
 * therefore shows a verdict its own form does not hold, and a closed section of empty required
 * fields becomes a block of red boxes for something nobody is being asked.
 *
 * So the rule is one line and lives in one place: *out of play, no verdict*. It covers the class on
 * the wrapper, the state on the label, `aria-invalid`, and whether the error text is rendered at
 * all — four faces of the same question, which is exactly how they came to disagree.
 *
 * What it deliberately does **not** do is forget the errors. The field keeps them, the form keeps
 * ignoring them, and both come back the moment the field is in play again — the verdict was never
 * wrong, it was being shown to someone who could not act on it.
 */
import type { MdyFieldError, MdyFormError } from "@modyra/core";

/** The errors a field may show, given whether the form is asking about it. */
export function shownErrors(
  flags: { readonly disabled: boolean },
  errors: ReadonlyArray<MdyFieldError>,
): ReadonlyArray<MdyFieldError> {
  return flags.disabled ? [] : errors;
}

/** Whether the field paints as failing: it is failing **and** the form is asking about it. */
export function showsAsInvalid(flags: { readonly disabled: boolean; readonly valid: boolean }): boolean {
  return !flags.valid && !flags.disabled;
}

/** What a field handle offers when asked for its verdict. */
export interface MdyFieldVerdictSource {
  errors(): ReadonlyArray<MdyFieldError>;
  disabled(): boolean;
}

/** {@link shownErrors}, asked of a field handle rather than of a state object. */
export function shownErrorsOf(handle: MdyFieldVerdictSource): ReadonlyArray<MdyFieldError> {
  return shownErrors({ disabled: handle.disabled() }, handle.errors());
}

/**
 * Whether the error text is on screen.
 *
 * Two conditions, and the second is the one renderers answer differently: a field is failing, **and**
 * the person has been given the chance to fill it. An invalid untouched field is the ordinary state
 * of an empty form — every required field holds an error before anyone has typed — so painting those
 * errors on arrival tells a user off for a form they have not started.
 *
 * Whatever names the error list — `aria-describedby` above all — reads the same answer, because a
 * reference to an element that was never rendered points at nothing.
 */
export function errorsVisible(
  flags: { readonly disabled: boolean; readonly touched: boolean },
  errors: ReadonlyArray<MdyFieldError>,
): boolean {
  return flags.touched && shownErrors(flags, errors).length > 0;
}

/**
 * The refusals the form shows for itself: the ones no field will show.
 *
 * A submit action returns errors, and one naming a field reaches the person through that field. One
 * naming no field — `path: null`, which is what a failed call or a service that is down produces —
 * has no field to reach them through, so the form says it or nobody does.
 */
export function formErrorsOf(errors: ReadonlyArray<MdyFormError>): ReadonlyArray<MdyFormError> {
  return errors.filter((error) => error.path === null);
}
