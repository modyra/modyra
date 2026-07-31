/**
 * The accessibility projection for the kinds that have no controller.
 *
 * `daterange`, `colors` and `file` are rendered without a widgets controller. That is a deliberate
 * split and still is: the range policy, the colour transitions and the file selection all live in
 * `@modyra/widgets`, and the renderers own only DOM and events. What went with it by accident is the
 * ARIA — nothing built a projection for these three, so they applied the *static* part contract and
 * nothing state-driven.
 *
 * The state matrix found six rows of it (`aria-invalid` and `aria-disabled` absent on all three).
 * The hole is wider than those rows: there was no `aria-required` and no `aria-describedby` either,
 * so a screen reader was never told that a range was invalid, and never told why — the error list
 * was rendered and tied to nothing.
 *
 * This is the shared half of {@link projectFieldA11y} with the input's own concerns left out —
 * `type`, `inputmode`, `autocomplete` and `readonly` all belong to a text control, and none of these
 * three kinds is one. Root classes are deliberately not projected here: the shell already applies
 * the kind's root classes, and restating them would be a second source of truth for something that
 * is not broken.
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
        // Disabled alone, never folded with read-only — none of these three kinds declares
        // read-only, and the two states are not interchangeable where they both exist.
        "aria-disabled": String(flags.disabled),
        // The point of the exercise. Without this the error list was rendered, styled, and
        // announced to nobody.
        "aria-describedby": hasErrors ? errorId : descriptionId,
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
