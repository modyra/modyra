/**
 * Accessibility projection for option-based field widgets (radio / segmented).
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type {
  MdyOptionFieldState,
  MdyOptionFieldVariant,
} from "./option-field-types.js";

export interface MdyOptionFieldA11yOptions {
  readonly widgetId: string;
  readonly variant: MdyOptionFieldVariant;
}

/** Builds the static IDs used by an option field widget view. */
export function optionFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly groupId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: `${widgetId}__label`,
    groupId: `${widgetId}__group`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__error`,
  };
}

/** Computes the public state classes for the option field root. */
export function optionFieldRootClasses<TValue>(
  state: MdyOptionFieldState<TValue>,
): readonly string[] {
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

/** Projects ARIA attributes and classes for the option field parts. */
export function projectOptionFieldA11y<TValue>(
  state: MdyOptionFieldState<TValue>,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyOptionFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly group: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, groupId, descriptionId, errorId } = optionFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: optionFieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: ["mdy-label"],
      attributes: {
        for: groupId,
      },
    },
    group: {
      id: groupId,
      classes: options.variant === "segmented" ? ["mdy-segmented"] : ["mdy-radio-group"],
      attributes: {
        role: "radiogroup",
        "aria-labelledby": labelId,
        "aria-invalid": hasErrors,
        "aria-required": state.required,
        "aria-disabled": state.disabled || state.readonly,
        "aria-describedby": describedBy,
        "aria-readonly": state.readonly,
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
