/**
 * Accessibility projection for the multiselect field widget. Angular's real
 * `MdyMultiselectComponent` intentionally uses a chip-group a11y pattern
 * (`role="group"` + `aria-pressed` on toggle chips), not listbox/option
 * semantics — this mirrors that choice rather than inventing a new one.
 */
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import type { MdyMultiselectFieldState } from "./multiselect-field-types.js";

export interface MdyMultiselectFieldA11yOptions {
  readonly widgetId: string;
}

/** Builds the static IDs used by a multiselect field widget view. */
export function multiselectFieldPartIds(widgetId: string): {
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

/** Computes the public state classes for the multiselect field root. */
export function multiselectFieldRootClasses<TValue>(
  state: MdyMultiselectFieldState<TValue>,
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

/** Projects ARIA attributes and classes for the multiselect field parts (root/label/group/description/error — per-option chip parts are built by the controller, same split option-field-controller.ts uses). */
export function projectMultiselectFieldA11y<TValue>(
  state: MdyMultiselectFieldState<TValue>,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyMultiselectFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly group: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, groupId, descriptionId, errorId } = multiselectFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: multiselectFieldRootClasses(state),
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
      classes: ["mdy-multiselect"],
      attributes: {
        role: "group",
        "aria-labelledby": labelId,
        "aria-invalid": hasErrors,
        "aria-required": state.required,
        "aria-disabled": state.disabled || state.readonly,
        "aria-describedby": describedBy,
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
