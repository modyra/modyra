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
import { MDY_VALUE_CONTRACTS, mdyEmptyValueFor, type MdyFieldError, type MdyFormError, type MdyValueKind } from "@modyra/core";
import type { MdyFieldConstraints } from "@modyra/core";

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

/**
 * A change to the value, recorded as the thing that makes a field answerable.
 *
 * Two flags, one act. `dirty` says the value is no longer what it arrived as, which is what a guard
 * against losing work reads; `touched` says this field has had an answer, which is what decides
 * whether a refusal is shown to somebody yet.
 *
 * They are set together because they are set by the same event, and separating them is what produced
 * the divergence ADR 0167 records: a kind whose control heard its own blur marked touched for a
 * person who only tabbed past, and a kind whose control was a button heard nothing at all, so the
 * same form answered differently depending on which kinds it happened to contain.
 *
 * Focus is deliberately not one of the events. Tab is how a person reads a form — the same way eyes
 * scroll it — and a form that answers a reading has moved false news to the start, onto fields
 * somebody was about to fill in.
 */
export function engageValue(handle: { markAsDirty(): void; markAsTouched(): void }): void {
  handle.markAsDirty();
  handle.markAsTouched();
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
  flags: {
    readonly disabled: boolean;
    readonly touched: boolean;
    /**
     * Whether the field holds a value nobody at this page typed — filled on arrival and not edited
     * since.
     *
     * The second half of the same principle the origins carry, and the half no origin can express: a
     * refusal about `150` in a field whose maximum is `50` is a rule, so its origin is `validation`,
     * and it is still about a value that is *already there*. `required` on an empty field is about
     * something not done yet; a bound broken by a value that arrived from a draft, a server or a
     * scripted write is about something the person can neither have caused nor understand unless it
     * is said.
     *
     * Optional: a caller that cannot tell says nothing, and gets the touched rule alone.
     */
    readonly holdsUnedited?: boolean;
  },
  errors: ReadonlyArray<MdyFieldError>,
): boolean {
  const shown = shownErrors(flags, errors);
  if (shown.length === 0) return false;
  if (flags.touched || flags.holdsUnedited === true) return true;
  return shown.some((error) => SPEAKS_IMMEDIATELY.has(error.origin ?? "validation"));
}

/**
 * Whether a field holds something nobody at this page entered.
 *
 * Not dirty and not empty: the value arrived with the form — a draft, a server, a scripted write —
 * and no edit has been made since. Emptiness is `required`'s question and is deliberately not this
 * one: a field with nothing in it has nothing to explain.
 */
export function holdsUneditedValue(
  state: { readonly value?: unknown; readonly dirty: boolean },
  kind?: MdyValueKind,
): boolean {
  if (state.dirty) return false;
  const value = state.value;
  if (value === null || value === undefined) return false;
  // The kind's own empty is not something that arrived. A slider always holds a number — a thumb is
  // always somewhere — so its default is the control at rest rather than a value a draft put there,
  // and a bound it breaks is not news until somebody has been at the field.
  if (kind !== undefined && sameEmpty(value, kind)) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return value;
  return true;
}

/**
 * Whether a value is the one this kind holds when it holds nothing.
 *
 * A kind this contract does not know is not this contract's to police: a consumer rendering their own
 * kind gets the touched rule and no opinion about what empty means for it.
 */
function sameEmpty(value: unknown, kind: MdyValueKind): boolean {
  if (!(kind in MDY_VALUE_CONTRACTS)) return false;
  const empty = mdyEmptyValueFor({ kind, name: "" } as never);
  if (Array.isArray(empty) && Array.isArray(value)) return value.length === 0;
  if (empty !== null && typeof empty === "object") return JSON.stringify(empty) === JSON.stringify(value);
  return Object.is(empty, value);
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
  handle: MdyFieldVerdictSource & {
    touched(): boolean;
    value?(): unknown;
    dirty?(): boolean;
  },
  /**
   * The kind, where the caller knows it, so that a value which *is* this kind's empty is not read as
   * one that arrived from somewhere. Without it a slider at 0 counts as holding something nobody
   * entered, and the field states a broken bound before anybody has been near it — while the
   * projection beside it, which does pass the kind, says nothing is being shown. Two answers to one
   * question, and the control ends up naming no error while the page displays one.
   */
  kind?: MdyValueKind,
): ReadonlyArray<MdyFieldError> {
  const flags = {
    disabled: handle.disabled(),
    touched: handle.touched(),
    holdsUnedited: handle.value !== undefined && handle.dirty !== undefined
      ? holdsUneditedValue({ value: handle.value(), dirty: handle.dirty() }, kind)
      : false,
  };
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
 *
 * **This door, or `fieldNameAttributes`, depending on the control — and the line between them is the
 * platform's, not a preference.** A control a `<label for>` can name natively — a text box, a
 * number, a checkbox, a `<select>` — is already named by its caption without anything being written
 * on it, so what a document *declares* is the extra thing to say, and it goes on as `aria-label`.
 * That is this door: what to call it, in one string.
 *
 * A **composite** has no such association: a radiogroup, a segmented control, a calendar grid are
 * elements a `<label for>` cannot point at, so the caption reaches them only by being referenced.
 * Those ask `fieldNameAttributes`, which chooses the attribute and refuses to write both.
 *
 * **The line is "is this control the whole widget", not "is this element labellable".** A date
 * picker's text box is an `<input>` a caption can point at, and it is still named through the other
 * door — because the box is one part of a widget that also has a calendar, and the name belongs to
 * the pair. Measured: a picker's control announces the caption by reference, exactly as a radiogroup
 * does, in more than one renderer. Reading the rule off the element alone puts those two kinds on
 * the wrong side of it.
 *
 * Four renderers follow this and none of them said so, which is exactly how it came to be
 * "repaired": a boundary nobody writes down reads as drift to the next person who sees one group of
 * kinds behaving unlike another. Six of one adapter's components used this door and two used the
 * other, and the split was the line above, not a divergence.
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

/**
 * Which attribute carries a control's name, and it is never both.
 *
 * Two names on one element is not two names: the computation takes `aria-labelledby` and stops, so
 * an `aria-label` beside it is text nobody will ever hear — and where the two disagree, the one a
 * developer is reading in the source is the one that does not speak.
 *
 * The caption wins where there is one, because it is on the page: a person hearing it and a person
 * reading it get the same words, and a caption that changes changes both. Where there is none, the
 * words are whatever the field can offer, and a reference to an empty element would be a name that
 * resolves to nothing.
 *
 * Returned as the attributes to apply rather than as a choice to act on, so a renderer cannot write
 * the pair by accident. ADR 0175.
 *
 * **For the controls a `<label for>` cannot reach**: a radiogroup, a segmented control, a calendar
 * grid. A control the platform can associate with its caption is named by `fieldAccessibleName`
 * instead — see the boundary written there. Asking this door for a text box would replace the words
 * a person reads with a reference, which is the same name told a longer way, and would drop the name
 * a document declared for it.
 */
export function fieldNameAttributes(sources: {
  readonly ariaLabel?: string | null;
  readonly label?: string | null;
  readonly name?: string | null;
  /** The caption's id, where the caption has words. */
  readonly labelId: string;
}): Readonly<Record<string, string | null>> {
  const captioned = typeof sources.label === "string" && sources.label.trim().length > 0;
  if (captioned) return { "aria-labelledby": sources.labelId, "aria-label": null };
  return { "aria-labelledby": null, "aria-label": fieldAccessibleName(sources) || null };
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

/**
 * Whether a field can fail a rule, and so whether its error container is reserved at rest.
 *
 * The reservation is not for the field that is failing — it is for the field *below* it. Someone
 * leaving a field is moving toward the next one, and that is exactly what drops when a message
 * appears under the field they just left. The jump from no line to one line lands under a thumb
 * already travelling.
 *
 * It does not stop every movement and must not be believed to: a two-line message moves things
 * anyway, a long one wraps on a narrow screen, and a validation arriving while focus is elsewhere
 * defeats it entirely. It closes the frequent case, which is validate-on-blur.
 *
 * Read from the field, never from its kind. An optional note with a length limit can fail a rule; a
 * checkbox that must be ticked can; a free-text note with no rule at all cannot, and reserving a
 * line under it is a line of scrolling bought for nothing.
 *
 * The container stays reserved once a message clears. Taking the space back is the same jump,
 * upward, under the same thumb — so it depends on the field's rules and never on its errors.
 */
export function fieldCanBeInvalid(field: {
  readonly required?: boolean;
  readonly constraints?: MdyFieldConstraints | null;
  /** Out of play — disabled by a binding, or inside a section a condition has closed. */
  readonly disabled?: boolean;
}): boolean {
  // A field the form is not asking about paints no verdict, so it has no message to make room for.
  // Reserving under it would hold space for something that cannot arrive, and — worse — would leave
  // the control describing itself by an error list it will never fill.
  if (field.disabled === true) return false;
  if (field.required === true) return true;
  const constraints = field.constraints as Readonly<Record<string, unknown>> | null | undefined;
  if (!constraints) return false;
  // A constraint present and undefined is a constraint nobody set: `{ max: undefined }` is what a
  // narrowing leaves behind, and counting the key would reserve a line under every field it touched.
  return Object.values(constraints).some((rule) => rule !== undefined && rule !== null);
}
