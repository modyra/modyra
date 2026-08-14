/**
 * Accessibility projection for the date-range field widget — the same WAI-ARIA grid pattern the
 * datepicker uses, with two controls instead of one.
 *
 * A range has a start and an end, and they are two labelled inputs rather than one. That is the
 * whole difference at this layer: which of the two the combobox semantics sit on, and how each is
 * named — a control named only by the field's own label leaves a screen-reader user two identical
 * boxes with no way to tell which end they are typing.
 */
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import type { MdyDaterangeFieldState } from "./daterange-field-types.js";
import { shownErrors } from "./verdict.js";
import { fieldShellRootClasses } from "./shell-a11y.js";

export interface MdyDaterangeFieldA11yOptions {
  readonly widgetId: string;
  /** How each end is named, for a host that translates. Defaults are English and deliberate. */
  readonly startLabel?: string;
  readonly endLabel?: string;
}

export function daterangeFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly startId: string;
  readonly endId: string;
  readonly gridId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: `${widgetId}__label`,
    startId: `${widgetId}__start`,
    endId: `${widgetId}__end`,
    gridId: `${widgetId}__grid`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__errors`,
  };
}

/** The root's classes, from the shared table every kind reads. */
export function daterangeFieldRootClasses(state: MdyDaterangeFieldState): readonly string[] {
  return fieldShellRootClasses(state as unknown as Readonly<Record<string, unknown>>);
}

export function projectDaterangeFieldA11y(
  state: MdyDaterangeFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyDaterangeFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly startControl: MdyPartContract;
  readonly endControl: MdyPartContract;
  readonly toggle: MdyPartContract;
  readonly grid: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, startId, endId, gridId, descriptionId, errorId } =
    daterangeFieldPartIds(options.widgetId);
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error text
  // renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(state, errors).length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;
  const definition = MDY_WIDGET_CONTRACTS.daterange;

  /** Both ends carry the same semantics and differ only in what they are called. */
  const end = (id: string, label: string, classes: readonly string[]): MdyPartContract => ({
    id,
    classes: [...classes],
    attributes: {
      "aria-labelledby": labelId,
      // Named as well as labelled: two boxes under one label are two boxes a screen-reader user
      // cannot tell apart, and "Stay" twice is not an answer to "which end am I in".
      "aria-label": label,
      "aria-invalid": String(hasErrors),
      "aria-required": String(state.required),
      "aria-disabled": String(state.disabled),
      "aria-describedby": describedBy,
      // The native attribute too: `aria-disabled` alone would announce a disabled field that still
      // accepts a typed date.
      disabled: state.disabled,
      // No `readonly`: a range is a chooser in `MDY_WIDGET_STATE_SUPPORT`, and the state was
      // reaching the DOM on a kind that declares no carrier for it — a control the user could not
      // type into, with nothing in the accessibility tree saying so and nothing stopping the
      // calendar from setting the same value.
    },
  });

  return {
    root: { classes: daterangeFieldRootClasses(state), attributes: {} },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      // The label points at the start, which is where a click on it should land: the first thing
      // a person fills. Pointing it at the wrapper would name neither.
      attributes: { for: startId },
    },
    startControl: end(startId, options.startLabel ?? "Start date", definition.parts.startControl.classes),
    endControl: end(endId, options.endLabel ?? "End date", definition.parts.endControl.classes),
    toggle: {
      classes: [...definition.parts.toggle.classes],
      attributes: {
        // The opener carries the combobox semantics, not the inputs: the overlay is one grid for
        // both ends, so one thing opens it and one thing says whether it is open.
        role: "combobox",
        "aria-haspopup": "grid",
        ...projectOverlayOpenerA11y("daterange", { widgetId: options.widgetId, open: state.open })
          ?.attributes,
        "aria-labelledby": labelId,
        "aria-disabled": String(state.disabled),
      },
    },
    grid: {
      id: gridId,
      classes: [...definition.parts.grid.classes],
      attributes: { role: "grid", "aria-labelledby": labelId },
    },
    description: {
      id: descriptionId,
      classes: [MDY_FIELD_SHELL_CLASSES.supportingText],
      attributes: {},
    },
    error: {
      id: errorId,
      classes: [MDY_FIELD_SHELL_CLASSES.errors],
      attributes: { "aria-live": "polite" },
    },
  };
}
