/**
 * Accessibility projection for boolean field widgets (checkbox / switch).
 */

import type { MdyFieldError } from "@modyra/core";
import { assertUsableWidgetId } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import { shownErrors } from "./verdict.js";
import { fieldShellRootClasses } from "./shell-a11y.js";
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
  assertUsableWidgetId(widgetId);
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
/** The root's classes, from the shared table every kind reads. */
export function booleanFieldRootClasses(state: MdyBooleanFieldState): readonly string[] {
  return fieldShellRootClasses(state as unknown as Readonly<Record<string, unknown>>);
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
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error
  // text renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(state, errors).length > 0;
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
        checked: state.checked === true,
        // One of the tokens the attribute is allowed to hold, never `String(whatever arrived)`.
        // This projection is published, so the state is the caller's to supply and its shape is not
        // ours to guarantee — but the attribute's value is, and `aria-checked="undefined"` maps to
        // nothing in any assistive technology, on the single attribute that says whether the box is
        // ticked. `mixed` is not produced: `MdyBooleanFieldState.checked` is a boolean and no field
        // in the engine has an indeterminate value, so emitting a third token would describe a state
        // nothing can be in.
        "aria-checked": state.checked === true ? "true" : "false",
        "aria-invalid": String(hasErrors),
        "aria-required": String(state.required),
        // `aria-disabled` reflects `disabled` alone. A read-only control is not disabled: it takes
        // focus, its text can be selected and copied, and announcing it as disabled tells a
        // screen-reader user they cannot interact with something they can. `aria-readonly`
        // carries read-only, and only on the kinds that declare the state.
        "aria-disabled": String(state.disabled),
        "aria-describedby": describedBy,
        // No read-only, in either half. `MDY_WIDGET_STATE_SUPPORT` does not list the state for a
        // boolean — "read-only would be a checkbox you can focus but not toggle, which is what
        // disabled already means" — and the two halves were failing in opposite directions: HTML
        // ignores `readonly` on a checkbox, so a renderer binding it bound nothing and the box
        // still toggled, while `aria-readonly="true"` told a screen-reader user it could not. An
        // omission is better than that pair. A form that means "this cannot be changed" says
        // `disabled`, which both halves implement.
        disabled: state.disabled,
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
