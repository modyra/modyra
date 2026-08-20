/**
 * Accessibility projection for the timepicker field widget.
 */
import { partClasses } from "../part-classes.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import type { MdyFieldError } from "@modyra/core";
import { assertUsableWidgetId } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import type { MdyTimepickerFieldState } from "./timepicker-field-types.js";
import { shownErrors } from "./verdict.js";
import { fieldShellRootClasses } from "./shell-a11y.js";

export interface MdyTimepickerFieldA11yOptions {
  readonly widgetId: string;
}

export function timepickerFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly triggerId: string;
  readonly dialogId: string;
  readonly hourId: string;
  readonly minuteId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  assertUsableWidgetId(widgetId);
  return {
    labelId: `${widgetId}__label`,
    triggerId: `${widgetId}__trigger`,
    dialogId: `${widgetId}__dialog`,
    hourId: `${widgetId}__hour`,
    minuteId: `${widgetId}__minute`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__errors`,
  };
}

/** The root's classes, from the shared table every kind reads. */
export function timepickerFieldRootClasses(state: MdyTimepickerFieldState): readonly string[] {
  return fieldShellRootClasses(state as unknown as Readonly<Record<string, unknown>>);
}

export function projectTimepickerFieldA11y(
  state: MdyTimepickerFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyTimepickerFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly trigger: MdyPartContract;
  readonly dialog: MdyPartContract;
  readonly hour: MdyPartContract;
  readonly hourControl: MdyPartContract;
  readonly minute: MdyPartContract;
  readonly minuteControl: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, triggerId, dialogId, hourId, minuteId, descriptionId, errorId } = timepickerFieldPartIds(options.widgetId);
  const hasErrors = shownErrors(state, errors).length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: timepickerFieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: { for: triggerId },
    },
    trigger: {
      id: triggerId,
      classes: [...MDY_WIDGET_CONTRACTS.timepicker.parts.control.classes],
      attributes: {
        role: "combobox",
        ...projectOverlayOpenerA11y("timepicker", { widgetId: options.widgetId, open: state.open })
          ?.attributes,
        "aria-labelledby": labelId,
        "aria-invalid": String(hasErrors),
        "aria-required": String(state.required),
        // `aria-disabled` reflects `disabled` alone. A read-only control is not disabled: it takes
        // focus, its text can be selected and copied, and announcing it as disabled tells a
        // screen-reader user they cannot interact with something they can. `aria-readonly`
        // carries read-only, and only on the kinds that declare the state.
        "aria-disabled": String(state.disabled),
        // A read-only field refuses the change and stays in play: focusable, submitted, validated.
        // What refuses it is the controller, and this is what says so — the state belongs on the
        // part the contract names as its carrier, which is the one a person operates.
        "aria-readonly": state.readonly ? "true" : null,
        // The native half as well, on a control whose text a person types: the platform stops the
        // typing and the ARIA says why. On a control HTML ignores `readonly` for, the widget's own
        // refusal is what holds and this attribute is left off rather than written as a claim
        // nothing acts on.
        readonly: state.readonly,
        "aria-describedby": describedBy,
        // The native attribute too, for the same reason as the datepicker: this part lands on a
        // typeable input, and ARIA alone left it operable.
        disabled: state.disabled,
      },
    },
    dialog: {
      id: dialogId,
      classes: [...MDY_WIDGET_CONTRACTS.timepicker.parts.dialog.classes],
      attributes: { role: "dialog", "aria-labelledby": labelId, "aria-modal": "true" },
    },
    // The segment is the container the header lays out, and it is what carries the state: `active`
    // is which of the two the dial is editing, `focused` which one has the caret. The value, the
    // name and the spinbutton semantics belong to the control inside it — a segment that took them
    // would announce a number nobody can reach.
    hour: {
      classes: partClasses("timepicker", "hour", { focused: state.focusedField === "hour" }),
      attributes: {},
    },
    hourControl: {
      id: hourId,
      classes: [...MDY_WIDGET_CONTRACTS.timepicker.parts.hourControl.classes],
      attributes: {
        role: "spinbutton",
        "aria-label": "Hour",
        "aria-valuemin": 1,
        "aria-valuemax": 12,
        "aria-valuenow": state.draft.hour,
      },
    },
    minute: {
      classes: partClasses("timepicker", "minute", { focused: state.focusedField === "minute" }),
      attributes: {},
    },
    minuteControl: {
      id: minuteId,
      classes: [...MDY_WIDGET_CONTRACTS.timepicker.parts.minuteControl.classes],
      attributes: {
        role: "spinbutton",
        "aria-label": "Minute",
        "aria-valuemin": 0,
        "aria-valuemax": 59,
        "aria-valuenow": state.draft.minute,
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
