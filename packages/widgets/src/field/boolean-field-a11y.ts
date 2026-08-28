/**
 * Accessibility projection for boolean field widgets (checkbox / switch).
 */

import type { MdyFieldError } from "@modyra/core";
import { fieldDescribedBy } from "./shell-a11y.js";
import { assertUsableWidgetId } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import { errorsVisible, holdsUneditedValue, shownErrors } from "./verdict.js";
import { fieldShellRootClasses } from "./shell-a11y.js";
import type {
  MdyBooleanFieldState,
  MdyBooleanFieldVariant,
} from "./boolean-field-types.js";

export interface MdyBooleanFieldA11yOptions {
  /**
   * Whether the error container is on the page, whether or not it holds a message.
   *
   * A renderer that keeps it under every field that can fail a rule passes this, and the control's
   * description then names one element that never changes — no moment at which the reference can
   * point at something not yet drawn, or already gone.
   *
   * Defaults to whether there are errors to show, so a renderer that draws the container only when it
   * has something to say is unaffected.
   */
  readonly errorsReserved?: boolean;
  readonly widgetId: string;
  readonly variant: MdyBooleanFieldVariant;
  /**
   * The key this control sends its value under when the browser submits the form it sits in.
   *
   * The field's path, not its widget id: a scope in a payload is a key the receiving end never asked
   * for, and two forms send the same key while staying apart, because a payload belongs to its form.
   */
  readonly submitName?: string;
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
  /**
   * The false half of the value, which HTML cannot express on its own.
   *
   * An unchecked box is **absent** from a form's payload — that is the rule — so `false` and "this
   * field was never sent" arrive identical, and a receiver cannot tell a person who said no from a
   * form that did not carry the question. This carries `false` under the same key, ahead of the box,
   * so the key is always present; when the box is checked it sends `true` after this one, and the
   * later value is the answer.
   *
   * Rendered only when the field has a submit name. Without one nothing here is serialised anyway,
   * and a hidden input in a form that cannot submit is a node with no reader.
   */
  readonly submitFalse: MdyPartContract;
  /** The drawn control: a checkbox's box, decorative because the native input carries the state. */
  readonly indicator: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { inputId, labelId, descriptionId, errorId } = booleanFieldPartIds(options.widgetId);
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error
  // text renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(state, errors).length > 0;
  // Whether the person is being told yet — `aria-invalid` says the same thing the error list does.
  // A rule they have not answered waits for them to reach the field; a refusal about the value
  // already there does not, because they can neither cause it by inaction nor see the reason unless
  // it is said.
  const tellingThem = errorsVisible({ disabled: state.disabled, touched: state.touched, holdsUnedited: holdsUneditedValue(state) }, errors);

  // Both, error first — an error does not take the place of the instruction that would have
  // prevented it. The container is pointed at while it is on the page, which is not the same as
  // while it holds a message: a renderer that reserves it keeps one reference that never changes.
  const describedBy = fieldDescribedBy({
    errorId,
    descriptionId,
    errorsPresent: options.errorsReserved ?? hasErrors,
    descriptionPresent: true,
  });
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
    // Carries `false` under the field's key, **after** the box in the document: a hidden input
    // before the visible control changes what `querySelector("input")` and `.first()` mean for
    // everyone reading the field, and that is the most obvious selector anybody writes.
    submitFalse: {
      classes: [],
      attributes: options.submitName === undefined ? {} : {
        type: "hidden",
        name: options.submitName,
        value: "false",
        // Silent while the box is ticked, so the payload carries one key rather than two: a ticked
        // box sends `true` alone and an unticked one sends `false` alone, with no repeated key for a
        // receiving end to resolve. Disabled with the field for the same reason a control is.
        disabled: state.disabled === true || state.checked === true,
      },
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
        // What a native submit reads, and the value it reads rather than the `on` HTML defaults to:
        // a payload saying `on` describes the box, not the answer.
        name: options.submitName ?? null,
        value: options.submitName === undefined ? null : "true",
        // One of the tokens the attribute is allowed to hold, never `String(whatever arrived)`.
        // This projection is published, so the state is the caller's to supply and its shape is not
        // ours to guarantee — but the attribute's value is, and `aria-checked="undefined"` maps to
        // nothing in any assistive technology, on the single attribute that says whether the box is
        // ticked. `mixed` is not produced: `MdyBooleanFieldState.checked` is a boolean and no field
        // in the engine has an indeterminate value, so emitting a third token would describe a state
        // nothing can be in.
        "aria-checked": state.checked === true ? "true" : "false",
        "aria-invalid": String(tellingThem),
        "aria-required": String(state.required),
        // `aria-disabled` reflects `disabled` alone. A read-only control is not disabled: it takes
        // focus, its text can be selected and copied, and announcing it as disabled tells a
        // screen-reader user they cannot interact with something they can. `aria-readonly`
        // carries read-only, and only on the kinds that declare the state.
        "aria-disabled": String(state.disabled),
        "aria-describedby": describedBy,
        // ARIA only, never the native attribute: HTML ignores `readonly` on a checkbox, so binding
        // it binds nothing. What refuses the toggle is the controller, and this is what says so.
        // A read-only field refuses the change and stays in play: focusable, submitted, validated.
        // The controller has held that rule for every kind for as long as `blocksValueChange` has
        // existed; saying nothing about it left a control that refuses with no way to say why.
        "aria-readonly": state.readonly ? "true" : null,
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
