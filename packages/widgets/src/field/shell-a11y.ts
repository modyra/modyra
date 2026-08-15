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
import { shownErrors } from "./verdict.js";
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
  const describedBy = errorsVisible
    ? errorId
    : (options.descriptionVisible ?? true) ? descriptionId : null;

  return {
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: options.controlId ? { for: options.controlId } : {},
    },
    control: {
      classes: [],
      attributes: {
        // What the field's rules state, in the attributes this kind's control can carry. Absent
        // members are `null`, which is how a part contract says "remove this".
        ...nativeConstraintAttributes(
          options.kind ?? "text",
          options.constraints ?? NO_CONSTRAINTS,
          options.value ?? null,
        ),
        "aria-invalid": String(hasErrors),
        "aria-required": String(flags.required),
        // Disabled alone, never folded with read-only: a read-only control is reachable, and
        // announcing it disabled tells a screen-reader user they cannot interact with something
        // they can.
        "aria-disabled": String(flags.disabled),
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
