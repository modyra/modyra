/**
 * The accessibility projection every field shell shares, independent of what the control is.
 *
 * Carries the state a screen reader needs — validity, requiredness, interactivity — and the
 * relations that tie the control to its label, description and error list. A widget that has no
 * controller of its own still needs all of it: without `aria-describedby` the error list is
 * rendered, styled, and announced to nobody.
 *
 * Deliberately narrower than a full field projection. `type`, `inputmode`, `autocomplete` and
 * `readonly` belong to a text control and are not projected here. Root classes are not projected
 * either: the shell already applies the kind's own, and restating them would create a second source
 * of truth.
 */
import type { MdyFieldConstraints, MdyFieldError } from "@modyra/core";
import { NO_CONSTRAINTS } from "@modyra/core";
import { nativeConstraintAttributes } from "../native-constraints.js";
import { defaultWidgetIdFactory as idFactory, assertUsableWidgetId } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
import { nameIsAFallback, shownErrors } from "./verdict.js";
import { widgetSupportsState } from "../widget-states.js";
import { MDY_WIDGET_KINDS, type MdyWidgetKind } from "../catalog/kinds.js";

/** The state a shell reflects: the flags, with no value and no control-specific concerns. */
export interface MdyFieldShellFlags {
  readonly disabled: boolean;
  readonly required: boolean;
  /**
   * Whether the field refuses changes while staying in play.
   *
   * Optional because it is the newer half: a caller that omits it says nothing about read-only,
   * which is what every caller did when only `disabled` reached the shell.
   */
  readonly readonly?: boolean;
}

/** The kinds whose control is a checkbox, and which therefore need a value of their own. */
const BOOLEAN_KINDS: ReadonlySet<string> = new Set(["checkbox", "toggle"]);

export interface MdyFieldShellA11yOptions {
  readonly widgetId: string;
  /**
   * The id the label points at. A daterange has two inputs and can point at only one, so the caller
   * names it rather than this guessing which control is the primary one.
   */
  readonly controlId?: string;
  /**
   * Whether the error list is actually in the document.
   *
   * The caller owns this because only the caller knows when it renders one. A renderer that defers
   * the list until the field is touched has errors long before it shows them, and deriving this
   * from `errors.length` would make `aria-describedby` name an element that is not in the document.
   *
   * Defaults to "there are errors", which is correct for a renderer that always shows them.
   */
  readonly errorsVisible?: boolean;
  /**
   * The key this control sends its value under when the browser submits the form it sits in.
   *
   * The field's path, not its widget id: the id carries a per-form scope so two forms on one page do
   * not collide, and a scope in a payload is a key the receiving end never asked for. Two forms send
   * the same key and stay apart, because a payload belongs to its form.
   *
   * Absent leaves the control unserialised, which is what a native submit does with a control that
   * has no name: it sends nothing at all, rather than sending it empty.
   */
  readonly submitName?: string;
  /**
   * Whether the control announces itself as failing.
   *
   * Separate from `errorsVisible`, which says what is on the page to point at. A field drawing its
   * refusal *inline* renders no error list, and a control that read one flag for both then said it
   * was valid while the field beside it was painted wrong and an icon stated the reason.
   *
   * Defaults to `errorsVisible`, so a renderer that draws its errors one way only is unaffected.
   */
  readonly invalid?: boolean;
  /**
   * What a document wrote for this field's name, when the caller knows it.
   *
   * Supplied, the label says whether it is showing words somebody chose or words the shell composed
   * because nobody did — which is the difference between a heading and a name owed to a screen
   * reader. Omitted, the label carries no such claim and nothing changes.
   */
  readonly nameSources?: { readonly ariaLabel?: string | null; readonly label?: string | null };
  /**
   * Whether the supporting-text element is in the document.
   *
   * Same reason as {@link MdyFieldShellA11yOptions.errorsVisible}: a renderer that only emits
   * supporting text when a host supplies some would otherwise be described by an element that does
   * not exist. When neither a description nor an error list is present, the control describes
   * itself by nothing.
   *
   * Defaults to true, for a renderer that always emits the element.
   */
  readonly descriptionVisible?: boolean;
  /**
   * Whether the error container is on the page, whether or not it holds a message.
   *
   * Distinct from {@link MdyFieldShellA11yOptions.errorsVisible}, which is about the message. A
   * renderer reserving the container under every field that can fail a rule passes this and keeps one
   * reference that never changes — and a reference that never changes has no moment at which it can
   * point at an element not yet drawn, or one already gone.
   *
   * Defaults to `errorsVisible`, so a renderer that draws the container only when it has something to
   * say is unaffected.
   */
  readonly errorsReserved?: boolean;
  /**
   * The kind whose control this is, so the shell knows which native constraints it can carry.
   */
  readonly kind?: string;
  /**
   * What the field's rules state, already narrowed by anything the control asks for.
   *
   * Here as well as in {@link import("./text-field-a11y.js").projectTextFieldA11y} because a renderer takes
   * its control part from one or the other, and a control's attributes cannot depend on which
   * projection its renderer happens to use.
   */
  readonly constraints?: MdyFieldConstraints;
  /**
   * What the field holds, where the kind draws it on a track.
   *
   * A slider's range is the only attribute that depends on the value: it has to span what the field
   * holds, or the thumb sits somewhere the form does not. See `sliderTrack`.
   */
  readonly value?: number | null;
}

/** The ids a shell's parts carry, so a renderer can put them on its own elements. */
export function fieldShellPartIds(widgetId: string): {
  readonly labelId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  assertUsableWidgetId(widgetId);
  return {
    labelId: idFactory.part(widgetId, "label"),
    descriptionId: idFactory.part(widgetId, "description"),
    errorId: idFactory.part(widgetId, "errors"),
  };
}

/**
 * The classes the field's own root carries, from the states it is in.
 *
 * Every kind had this function, and every copy was the same five lines over the same table. The
 * states a root may carry are declared once in `MDY_FIELD_STATE_CLASSES`; deriving the classes from
 * them is not a per-kind decision.
 */
export function fieldShellRootClasses(state: Readonly<Record<string, unknown>>): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates.filter((name: string) => Boolean(state[name])).map((name: string) => `${S.field}--${name}`),
  ];
}

/**
 * Whether this kind announces read-only at all.
 *
 * A kind this contract does not know is not this contract's to police: a consumer rendering their
 * own kind keeps what they had.
 */
function announcesReadonly(kind: string | undefined): boolean {
  if (kind === undefined) return true;
  return (MDY_WIDGET_KINDS as readonly string[]).includes(kind)
    ? widgetSupportsState(kind as MdyWidgetKind, "readonly")
    : true;
}

export function projectFieldShellA11y(
  flags: MdyFieldShellFlags,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyFieldShellA11yOptions,
): {
  readonly label: MdyPartContract;
  /** Applied to whichever element the widget treats as its operable control. */
  readonly control: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, descriptionId, errorId } = fieldShellPartIds(options.widgetId);
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error
  // text renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(flags, errors).length > 0;
  // What the control describes itself by depends on what was *rendered*, not on what is wrong.
  const errorsVisible = options.errorsVisible ?? hasErrors;
  // Whether the control announces itself as failing is a different question from which element
  // carries the words. A field showing its errors *inline* renders no error list, so the one flag
  // answered "nothing rendered" and the control said it was valid — while the wrapper beside it
  // painted the refusal and an icon stated it. `aria-invalid` follows the verdict; `aria-describedby`
  // follows what exists to point at.
  const told = options.invalid ?? errorsVisible;
  const describedBy = fieldDescribedBy({
    errorId,
    descriptionId,
    // The error container is pointed at whenever it is on the page, which is not the same as
    // whenever it holds a message: a renderer that reserves it at rest keeps one stable reference
    // instead of writing one when a message arrives and withdrawing it when the message clears.
    errorsPresent: options.errorsReserved ?? errorsVisible,
    // A description exists when the renderer says one does. Defaulted to `true`, a control claimed
    // `aria-describedby` at rest and pointed it at an element holding nothing — which asserts that a
    // description exists and sends a reader to a text nobody wrote. It also makes "I have a
    // description, and it is empty" indistinguishable from "I have none", where silence is the
    // honest statement of nothing to say. The errors half of this reference was repaired for exactly
    // that reason; the hint half is the same shape.
    descriptionPresent: options.descriptionVisible ?? false,
  });

  return {
    label: {
      id: labelId,
      classes: [
        MDY_FIELD_SHELL_CLASSES.label,
        ...(options.nameSources !== undefined && nameIsAFallback(options.nameSources)
          ? [`${MDY_FIELD_SHELL_CLASSES.label}--unwritten`]
          : []),
      ],
      attributes: options.controlId ? { for: options.controlId } : {},
    },
    control: {
      classes: [],
      attributes: {
        // What a native submit reads. Every renderer that binds this part gets it, which is the
        // point of it living here: three renderers writing the same attribute is three places for
        // one of them to forget.
        name: options.submitName ?? null,
        // A checked box with no `value` sends the string `on`, which describes the box rather than
        // the answer. The kinds whose control is a checkbox say what they mean instead.
        value: options.submitName !== undefined && BOOLEAN_KINDS.has(options.kind ?? "") ? "true" : null,
        // What the field's rules state, in the attributes this kind's control can carry. Absent
        // members are `null`, which is how a part contract says "remove this".
        ...nativeConstraintAttributes(
          options.kind ?? "text",
          options.constraints ?? NO_CONSTRAINTS,
          options.value ?? null,
        ),
        // What is *shown*, not what is wrong. The four faces of one question include this one: a
        // control marked wrong beside a message nobody rendered is a verdict with no explanation,
        // and the person it is about did nothing to earn it.
        "aria-invalid": String(told),
        "aria-required": String(flags.required),
        // Disabled alone, never folded with read-only: a read-only control is reachable, and
        // announcing it disabled tells a screen-reader user they cannot interact with something
        // they can.
        "aria-disabled": String(flags.disabled),
        // And the native refusal beside the announced one. `aria-disabled` says a control cannot be
        // used; only `disabled` makes that true. A kind that carried the first without the second
        // announced a refusal it did not enforce — the control stayed operable, and a press changed
        // a value the model refuses. Two kinds reached their renderers that way, because the
        // projections that add it themselves are the ones that happened to.
        disabled: flags.disabled,
        // Read-only in its own word, on the kinds that declare the state. A control that refuses
        // every change while staying focusable and submitted looks identical to one that does not;
        // `file` is the kind that declares no read-only — its picker is the browser's and its role
        // has no attribute to carry this.
        "aria-readonly": flags.readonly && announcesReadonly(options.kind) ? "true" : null,
        // Names the error list only while it is rendered; otherwise the description, if there is one.
        "aria-describedby": describedBy,
      },
    },
    description: {
      id: descriptionId,
      classes: [MDY_FIELD_SHELL_CLASSES.supportingText],
      attributes: {},
    },
    error: {
      id: errorId,
      classes: [MDY_FIELD_SHELL_CLASSES.errors],
      attributes: {
        // A live region and nothing more. `role="alert"` here would override the list semantics of
        // the <ul> it sits on: axe reports every <li> inside such a list as an orphaned list item, and
        // a screen reader sees the same thing. `aria-live` announces the list when it appears, so the
        // role would cost the structure and add nothing.
        "aria-live": "polite",
      },
    },
  };
}

/**
 * What describes a control: its error, then its help, both when both are there.
 *
 * Not one or the other. An error message does not take the place of the instruction that would have
 * prevented it — losing the help at the moment it is most useful — and a description is a list, so
 * both fit. The error goes first because it is the new thing, and somebody who moves on after the
 * first sentence has heard the one that mattered.
 *
 * An element with no text contributes nothing to the description: it is not read as a pause or as
 * "empty", it is as though the reference were absent, until text appears inside it. That is what
 * makes a permanently-present reference cheaper than a correct one.
 */
export function fieldDescribedBy(parts: {
  readonly errorId: string;
  readonly descriptionId: string;
  readonly errorsPresent: boolean;
  readonly descriptionPresent: boolean;
}): string | null {
  const named = [
    parts.errorsPresent ? parts.errorId : null,
    parts.descriptionPresent ? parts.descriptionId : null,
  ].filter((id): id is string => id !== null);
  return named.length > 0 ? named.join(" ") : null;
}
