/**
 * Accessibility projection for the timepicker field widget.
 */
import { partClasses } from "../part-classes.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
import type { MdyTimepickerFieldState } from "./timepicker-field-types.js";

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

export function timepickerFieldRootClasses(state: MdyTimepickerFieldState): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
  ];
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
  readonly minute: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, triggerId, dialogId, hourId, minuteId, descriptionId, errorId } = timepickerFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
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
        "aria-haspopup": "dialog",
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
    hour: {
      id: hourId,
      classes: partClasses("timepicker", "hour", { focused: state.focusedField === "hour" }),
      attributes: {
        role: "spinbutton",
        "aria-label": "Hour",
        "aria-valuemin": 1,
        "aria-valuemax": 12,
        "aria-valuenow": state.draft.hour,
      },
    },
    minute: {
      id: minuteId,
      classes: partClasses("timepicker", "minute", { focused: state.focusedField === "minute" }),
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
        // A live region and nothing more. This used to carry `role="alert"` as well, which replaced
        // the list semantics of the <ul> it sits on — axe reports every <li> inside such a list as an
        // orphaned list item, and a screen reader sees the same thing. `aria-live` already announces
        // the list when it appears, so the role added nothing and cost the structure.
        "aria-live": "polite",
      },
    },
  };
}
