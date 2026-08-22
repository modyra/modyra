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
 * The refusals that reach a person the moment they arrive, whatever they have touched.
 *
 * A rule the person has not answered yet and a value the field cannot hold are both "invalid" and
 * are not the same news. `required` is about what they have not done — shown before they reach the
 * field, it tells somebody off for arriving. A shape refusal, a server's answer, an entry the
 * control could not read are about what is *already there*: they cannot cause them by inaction and
 * cannot see the reason unless it is said, so waiting for a touch withholds the only explanation of
 * a control already painted as wrong.
 */
const SPEAKS_IMMEDIATELY: ReadonlySet<string> = new Set(["shape", "server", "entry"]);

export function errorsVisible(
  flags: { readonly disabled: boolean; readonly touched: boolean },
  errors: ReadonlyArray<MdyFieldError>,
): boolean {
  const shown = shownErrors(flags, errors);
  if (shown.length === 0) return false;
  return flags.touched || shown.some((error) => SPEAKS_IMMEDIATELY.has(error.origin ?? "validation"));
}

/**
 * The messages a field shows right now: its shown errors, or none until it is in play.
 *
 * `shownErrorsOf` answers *which refusals exist*; this answers *whether the person is being told
 * yet*, which is the question a renderer painting an error list is actually asking. Written out at
 * each call site, nine of them decided it separately and one renderer told a person their field was
 * required before they had reached it.
 */
export function visibleErrorsOf(
  handle: MdyFieldVerdictSource & { touched(): boolean },
): ReadonlyArray<MdyFieldError> {
  const flags = { disabled: handle.disabled(), touched: handle.touched() };
  return errorsVisible(flags, handle.errors()) ? shownErrors(flags, handle.errors()) : [];
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

/**
 * The name a control carries, given what a document said about the field.
 *
 * A label is optional in a document, deliberately: the published corpus declares fields without one,
 * and refusing them would invalidate the material that documents the contract. But a control with no
 * accessible name is announced as its role and nothing else — "text box", "grid" — which
 * `MDY_SEMANTICS_REQUIRING_NAME` already says some roles may not be.
 *
 * So the field's own name is the fallback, and it is not a poor one. A document's field name is a
 * single segment — a dotted path is refused where the document is read — and the corpus shows the
 * names are the label's own words: `city`, `zip`, `email`, `first`, `last`, beside labels reading
 * `City`, `ZIP`. Announcing `city` is announcing the word the author would have written.
 *
 * Order: what a host wrote for the control, then the visible label, then the field's name. A host
 * that says nothing and a document that says nothing still leave one thing to say.
 */
export function fieldAccessibleName(sources: {
  readonly ariaLabel?: string | null;
  readonly label?: string | null;
  readonly name?: string | null;
}): string {
  for (const candidate of [sources.ariaLabel, sources.label, sources.name]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }
  return "";
}

/** Whether the name a control carries came from the field's own name rather than from words for a person. */
export function nameIsAFallback(sources: {
  readonly ariaLabel?: string | null;
  readonly label?: string | null;
}): boolean {
  return !(
    (typeof sources.ariaLabel === "string" && sources.ariaLabel.trim().length > 0) ||
    (typeof sources.label === "string" && sources.label.trim().length > 0)
  );
}
