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
import type { MdyFieldError } from "@modyra/core";
import { defaultWidgetIdFactory as idFactory } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";

/** The state a shell reflects: the flags, with no value and no control-specific concerns. */
export interface MdyFieldShellFlags {
  readonly disabled: boolean;
  readonly required: boolean;
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
}

/** The ids a shell's parts carry, so a renderer can put them on its own elements. */
export function fieldShellPartIds(widgetId: string): {
  readonly labelId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: idFactory.part(widgetId, "label"),
    descriptionId: idFactory.part(widgetId, "description"),
    errorId: idFactory.part(widgetId, "errors"),
  };
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
  const hasErrors = errors.length > 0;
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
        "aria-invalid": String(hasErrors),
        "aria-required": String(flags.required),
        // Disabled alone, never folded with read-only: a read-only control is reachable, and
        // announcing it disabled tells a screen-reader user they cannot interact with something
        // they can.
        "aria-disabled": String(flags.disabled),
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
        role: "alert",
        "aria-live": "polite",
      },
    },
  };
}
