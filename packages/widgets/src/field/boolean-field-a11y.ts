/**
 * Accessibility projection for boolean field widgets (checkbox / switch).
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type {
  MdyBooleanFieldState,
  MdyBooleanFieldVariant,
} from "./boolean-field-types.js";

export interface MdyBooleanFieldA11yOptions {
  readonly widgetId: string;
  readonly variant: MdyBooleanFieldVariant;
}

/** Builds the static IDs used by a boolean field widget view. */
export function booleanFieldPartIds(widgetId: string): {
  readonly inputId: string;
  readonly labelId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    inputId: `${widgetId}__input`,
    labelId: `${widgetId}__label`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__error`,
  };
}

/** Computes the public state classes for the boolean field root. */
export function booleanFieldRootClasses(state: MdyBooleanFieldState): readonly string[] {
  return [
    "mdy-field",
    `mdy-field--${state.checked ? "checked" : "unchecked"}`,
    ...(state.invalid ? ["mdy-field--invalid"] : []),
    ...(state.disabled ? ["mdy-field--disabled"] : []),
    ...(state.readonly ? ["mdy-field--readonly"] : []),
    ...(state.required ? ["mdy-field--required"] : []),
    ...(state.touched ? ["mdy-field--touched"] : []),
    ...(state.dirty ? ["mdy-field--dirty"] : []),
    ...(state.pending ? ["mdy-field--pending"] : []),
  ];
}

/** Projects ARIA attributes and classes for the boolean field parts. */
export function projectBooleanFieldA11y(
  state: MdyBooleanFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyBooleanFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly input: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { inputId, labelId, descriptionId, errorId } = booleanFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;
  const isSwitch = options.variant === "switch";

  return {
    root: {
      classes: booleanFieldRootClasses(state),
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
      classes: isSwitch ? ["mdy-switch"] : ["mdy-checkbox"],
      attributes: {
        type: isSwitch ? null : "checkbox",
        role: isSwitch ? "switch" : "checkbox",
        checked: state.checked,
        "aria-checked": state.checked,
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
