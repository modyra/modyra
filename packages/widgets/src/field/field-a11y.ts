/**
 * Accessibility projection for primitive field widgets.
 */

import type { MdyFieldError } from "@modyra/core";
import { defaultWidgetIdFactory as idFactory } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
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
    labelId: idFactory.part(widgetId, "label"),
    descriptionId: idFactory.part(widgetId, "description"),
    errorId: idFactory.part(widgetId, "errors"),
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
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: {
        for: inputId,
      },
    },
    input: {
      id: inputId,
      classes: [],
      attributes: {
        type: options.inputType ?? "text",
        inputmode: options.inputMode ?? null,
        autocomplete: options.autocomplete ?? null,
        "aria-invalid": String(hasErrors),
        "aria-required": String(state.required),
        "aria-disabled": String(state.disabled || state.readonly),
        "aria-describedby": describedBy,
        // Emitted only when true. A control that is not read-only says nothing, rather than
        // announcing `aria-readonly="false"` — which on a slider, a checkbox or a radio group
        // told a screen reader that read-only was a meaningful axis for something where the
        // concept does not exist. That was the signature of an ARIA shell applied mechanically
        // to every control; the states each kind actually admits are declared in
        // `widget-states.ts`, and none of these three is among them.
        "aria-readonly": state.readonly ? "true" : null,
        disabled: state.disabled,
        readonly: state.readonly,
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
