/**
 * Accessibility projection for option-based field widgets (radio / segmented).
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_CSS_PROPERTIES } from "../css.js";
import { MDY_FIELD_STATE_CLASSES, MDY_FIELD_SHELL_CLASSES } from "../structure.js";
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
  // Through the shared vocabulary rather than as literals: these were eight hand-written
  // `mdy-field--*` names and no theme styled one of them.
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
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
        // `aria-disabled` reflects `disabled` alone. A read-only control is not disabled: it takes
        // focus, its text can be selected and copied, and announcing it as disabled tells a
        // screen-reader user they cannot interact with something they can. `aria-readonly`
        // carries read-only, and only on the kinds that declare the state.
        "aria-disabled": String(state.disabled),
        "aria-describedby": describedBy,
        // Emitted only when true. A control that is not read-only says nothing, rather than
        // announcing `aria-readonly="false"` — which on a slider, a checkbox or a radio group
        // told a screen reader that read-only was a meaningful axis for something where the
        // concept does not exist. That was the signature of an ARIA shell applied mechanically
        // to every control; the states each kind actually admits are declared in
        // `widget-states.ts`, and none of these three is among them.
        "aria-readonly": state.readonly ? "true" : null,
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
        // A live region and nothing more. This used to carry `role="alert"` as well, which replaced
        // the list semantics of the <ul> it sits on — axe reports every <li> inside such a list as an
        // orphaned list item, and a screen reader sees the same thing. `aria-live` already announces
        // the list when it appears, so the role added nothing and cost the structure.
        "aria-live": "polite",
      },
    },
  };
}
