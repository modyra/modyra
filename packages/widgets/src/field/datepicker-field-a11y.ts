/**
 * Accessibility projection for the datepicker field widget — WAI-ARIA grid
 * pattern (`role="grid"`/`role="gridcell"`), matching how
 * `calendarKeyboardTarget`'s own doc comment already describes the
 * interaction model this implements.
 */
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
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
    errorId: `${widgetId}__error`,
  };
}

export function datepickerFieldRootClasses(state: MdyDatepickerFieldState): readonly string[] {
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
      classes: ["mdy-datepicker__trigger"],
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
        // The native attribute too. Plain applies this part to the typeable input, so without it a
        // disabled datepicker announced itself disabled and still accepted a typed date — the
        // exact gap `nativeAttribute` exists to catch.
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
        role: "alert",
        "aria-live": "polite",
      },
    },
  };
}
