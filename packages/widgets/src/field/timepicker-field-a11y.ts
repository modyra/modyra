/**
 * Accessibility projection for the timepicker field widget.
 */
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type { MdyTimepickerFieldState } from "./timepicker-field-types.js";

export interface MdyTimepickerFieldA11yOptions {
  readonly widgetId: string;
}

export function timepickerFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly triggerId: string;
  readonly dialogId: string;
  readonly hourId: string;
  readonly minuteId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: `${widgetId}__label`,
    triggerId: `${widgetId}__trigger`,
    dialogId: `${widgetId}__dialog`,
    hourId: `${widgetId}__hour`,
    minuteId: `${widgetId}__minute`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__error`,
  };
}

export function timepickerFieldRootClasses(state: MdyTimepickerFieldState): readonly string[] {
  return [
    "mdy-field",
    ...(state.invalid ? ["mdy-field--invalid"] : []),
    ...(state.disabled ? ["mdy-field--disabled"] : []),
    ...(state.readonly ? ["mdy-field--readonly"] : []),
    ...(state.required ? ["mdy-field--required"] : []),
    ...(state.touched ? ["mdy-field--touched"] : []),
    ...(state.dirty ? ["mdy-field--dirty"] : []),
    ...(state.pending ? ["mdy-field--pending"] : []),
  ];
}

export function projectTimepickerFieldA11y(
  state: MdyTimepickerFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyTimepickerFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly trigger: MdyPartContract;
  readonly dialog: MdyPartContract;
  readonly hour: MdyPartContract;
  readonly minute: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, triggerId, dialogId, hourId, minuteId, descriptionId, errorId } = timepickerFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: timepickerFieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: ["mdy-label"],
      attributes: { for: triggerId },
    },
    trigger: {
      id: triggerId,
      classes: ["mdy-timepicker__trigger"],
      attributes: {
        role: "combobox",
        "aria-haspopup": "dialog",
        "aria-expanded": state.open,
        "aria-labelledby": labelId,
        "aria-invalid": hasErrors,
        "aria-required": state.required,
        "aria-disabled": state.disabled || state.readonly,
        "aria-describedby": describedBy,
      },
    },
    dialog: {
      id: dialogId,
      classes: ["mdy-timepicker__dialog"],
      attributes: { role: "dialog", "aria-labelledby": labelId, "aria-modal": true },
    },
    hour: {
      id: hourId,
      classes: ["mdy-timepicker__hour", ...(state.focusedField === "hour" ? ["mdy-timepicker__hour--focused"] : [])],
      attributes: {
        role: "spinbutton",
        "aria-label": "Hour",
        "aria-valuemin": 1,
        "aria-valuemax": 12,
        "aria-valuenow": state.draft.hour,
      },
    },
    minute: {
      id: minuteId,
      classes: ["mdy-timepicker__minute", ...(state.focusedField === "minute" ? ["mdy-timepicker__minute--focused"] : [])],
      attributes: {
        role: "spinbutton",
        "aria-label": "Minute",
        "aria-valuemin": 0,
        "aria-valuemax": 59,
        "aria-valuenow": state.draft.minute,
      },
    },
    description: {
      id: descriptionId,
      classes: ["mdy-description"],
      attributes: {},
    },
    error: {
      id: errorId,
      classes: ["mdy-error"],
      attributes: {
        role: "alert",
        "aria-live": "polite",
      },
    },
  };
}
