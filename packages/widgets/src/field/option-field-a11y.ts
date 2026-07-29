/**
 * Accessibility projection for option-based field widgets (radio / segmented).
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_CSS_PROPERTIES } from "../css.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import type {
  MdyOptionFieldState,
  MdyOptionFieldVariant,
} from "./option-field-types.js";

export interface MdyOptionFieldA11yOptions {
  readonly widgetId: string;
  readonly variant: MdyOptionFieldVariant;
  /** How many options the group renders. The segmented theme sizes its tick gutter from it. */
  readonly optionCount: number;
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
      classes: [MDY_FIELD_SHELL_CLASSES.label],
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
        "aria-invalid": String(hasErrors),
        "aria-required": String(state.required),
        "aria-disabled": String(state.disabled || state.readonly),
        "aria-describedby": describedBy,
        "aria-readonly": String(state.readonly),
      },
      // The segmented theme sizes its tick gutter from the number of segments; the count is the
      // widget's own knowledge, so it travels with the part rather than being restated per adapter.
      ...(options.variant === "segmented"
        ? { style: { [MDY_CSS_PROPERTIES.control.segmentCount]: String(options.optionCount) } }
        : {}),
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
