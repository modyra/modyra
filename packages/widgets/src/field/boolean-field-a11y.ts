/**
 * Accessibility projection for boolean field widgets (checkbox / switch).
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
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
    errorId: `${widgetId}__errors`,
  };
}

/**
 * Computes the public state classes for the boolean field root.
 *
 * Through the shared vocabulary rather than as literals: these were nine hand-written `mdy-field--*`
 * names, and no theme styled a single one of them.
 */
export function booleanFieldRootClasses(state: MdyBooleanFieldState): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
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
  /** The drawn control: a checkbox's box, decorative because the native input carries the state. */
  readonly indicator: MdyPartContract;
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
      // A switch labels its text `mdy-toggle__label`; `mdy-checkbox`/`mdy-toggle` belong on the
      // wrapping element, which is why the input itself carries no class of its own.
      classes: [isSwitch ? "mdy-toggle__label" : MDY_FIELD_SHELL_CLASSES.label],
      // The clickable element is the wrapper, and the text sits inside it as a span — a `for`
      // here would be an invalid attribute on a non-label element.
      attributes: {},
    },
    indicator: {
      // A switch draws track and thumb instead; the checkbox's box is one element.
      classes: isSwitch ? ["mdy-toggle__track"] : ["mdy-checkbox__indicator"],
      attributes: { "aria-hidden": "true" },
    },
    input: {
      id: inputId,
      classes: [],
      attributes: {
        // A switch is a checkbox input carrying `role="switch"`. Dropping the type would leave a
        // text input behind.
        type: "checkbox",
        role: isSwitch ? "switch" : "checkbox",
        checked: state.checked,
        "aria-checked": String(state.checked),
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
        // A live region and nothing more. `role="alert"` here would override the list semantics of
        // the <ul> it sits on: axe reports every <li> inside such a list as an orphaned list item, and
        // a screen reader sees the same thing. `aria-live` announces the list when it appears, so the
        // role would cost the structure and add nothing.
        "aria-live": "polite",
      },
    },
  };
}
