/**
 * Accessibility projection for the datepicker field widget — WAI-ARIA grid
 * pattern (`role="grid"`/`role="gridcell"`), matching how
 * `calendarKeyboardTarget`'s own doc comment already describes the
 * interaction model this implements.
 */
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
import type { MdyDatepickerFieldState } from "./datepicker-field-types.js";

export interface MdyDatepickerFieldA11yOptions {
  readonly widgetId: string;
}

export function datepickerFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly triggerId: string;
  readonly gridId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: `${widgetId}__label`,
    triggerId: `${widgetId}__trigger`,
    gridId: `${widgetId}__grid`,
    descriptionId: `${widgetId}__description`,
    errorId: `${widgetId}__errors`,
  };
}

export function datepickerFieldRootClasses(state: MdyDatepickerFieldState): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
  ];
}

export function projectDatepickerFieldA11y(
  state: MdyDatepickerFieldState,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyDatepickerFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly trigger: MdyPartContract;
  readonly grid: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, triggerId, gridId, descriptionId, errorId } = datepickerFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: datepickerFieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: { for: triggerId },
    },
    trigger: {
      id: triggerId,
      classes: [...MDY_WIDGET_CONTRACTS.datepicker.parts.control.classes],
      attributes: {
        role: "combobox",
        "aria-haspopup": "grid",
        ...projectOverlayOpenerA11y("datepicker", { widgetId: options.widgetId, open: state.open })
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
        // The native attribute too, not only the ARIA one. Where this part lands on the typeable
        // input, `aria-disabled` alone would announce a disabled field that still accepts a typed
        // date.
        disabled: state.disabled,
      },
    },
    grid: {
      id: gridId,
      classes: ["mdy-datepicker__grid"],
      attributes: {
        role: "grid",
        "aria-labelledby": labelId,
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
