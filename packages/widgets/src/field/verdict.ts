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
import type { MdyFieldError } from "@modyra/core";

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
