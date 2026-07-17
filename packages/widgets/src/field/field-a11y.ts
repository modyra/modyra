/**
 * Accessibility projection for primitive field widgets.
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type { MdyFieldState } from "./field-types.js";

export interface MdyFieldA11yOptions {
  readonly widgetId: string;
  readonly inputType?: string;
  readonly inputMode?: string;
  readonly autocomplete?: string;
}

/** Builds the static IDs used by a field widget view. */
export function fieldPartIds(widgetId: string): {
  readonly inputId: string;
  readonly labelId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    inputId: widgetId,
    labelId: `${widgetId}-label`,
    descriptionId: `${widgetId}-description`,
    errorId: `${widgetId}-errors`,
  };
}

/** Computes the public state classes for the field root. */
export function fieldRootClasses<TValue>(state: MdyFieldState<TValue>): readonly string[] {
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

/** Projects ARIA attributes and classes for the field parts. */
export function projectFieldA11y<TValue>(
  state: MdyFieldState<TValue>,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly input: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { inputId, labelId, descriptionId, errorId } = fieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: fieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: ["mdy-label"],
      attributes: {
        for: inputId,
      },
    },
    input: {
      id: inputId,
      classes: ["mdy-input"],
      attributes: {
        type: options.inputType ?? "text",
        inputmode: options.inputMode ?? null,
        autocomplete: options.autocomplete ?? null,
        "aria-invalid": hasErrors,
        "aria-required": state.required,
        "aria-disabled": state.disabled || state.readonly,
        "aria-describedby": describedBy,
        "aria-readonly": state.readonly,
        disabled: state.disabled,
        readonly: state.readonly,
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
