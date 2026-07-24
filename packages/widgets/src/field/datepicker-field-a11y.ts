/**
 * Accessibility projection for the datepicker field widget — WAI-ARIA grid
 * pattern (`role="grid"`/`role="gridcell"`), matching how
 * `calendarKeyboardTarget`'s own doc comment already describes the
 * interaction model this implements.
 */
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type { MdyDatepickerFieldState } from "./datepicker-field-types.js";

export interface MdyDatepickerFieldA11yOptions {
  readonly widgetId: string;
}

export function datepickerFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly triggerId: string;
  readonly gridId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: `${widgetId}__label`,
    triggerId: `${widgetId}__trigger`,
    gridId: `${widgetId}__grid`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__error`,
  };
}

export function datepickerFieldRootClasses(state: MdyDatepickerFieldState): readonly string[] {
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

export function projectDatepickerFieldA11y(
  state: MdyDatepickerFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyDatepickerFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly trigger: MdyPartContract;
  readonly grid: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, triggerId, gridId, descriptionId, errorId } = datepickerFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: datepickerFieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: ["mdy-label"],
      attributes: { for: triggerId },
    },
    trigger: {
      id: triggerId,
      classes: ["mdy-datepicker__trigger"],
      attributes: {
        role: "combobox",
        "aria-haspopup": "grid",
        "aria-expanded": state.open,
        "aria-labelledby": labelId,
        "aria-invalid": hasErrors,
        "aria-required": state.required,
        "aria-disabled": state.disabled || state.readonly,
        "aria-describedby": describedBy,
      },
    },
    grid: {
      id: gridId,
      classes: ["mdy-datepicker__grid"],
      attributes: {
        role: "grid",
        "aria-labelledby": labelId,
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
