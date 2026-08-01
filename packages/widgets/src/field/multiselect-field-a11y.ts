/**
 * Accessibility projection for the multiselect field widget. Angular's real
 * `MdyMultiselectComponent` intentionally uses a chip-group a11y pattern
 * (`role="group"` + `aria-pressed` on toggle chips), not listbox/option
 * semantics — this mirrors that choice rather than inventing a new one.
 */
import { blocksFocus } from "../interactivity.js";
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import type { MdyMultiselectFieldState } from "./multiselect-field-types.js";

export interface MdyMultiselectFieldA11yOptions {
  readonly widgetId: string;
}

/** Builds the static IDs used by a multiselect field widget view. */
export function multiselectFieldPartIds(widgetId: string): {
  readonly labelId: string;
  readonly groupId: string;
  readonly triggerId: string;
  readonly popupId: string;
  readonly searchId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  return {
    labelId: `${widgetId}__label`,
    groupId: `${widgetId}__group`,
    triggerId: `${widgetId}__trigger`,
    popupId: `${widgetId}__popup`,
    searchId: `${widgetId}__search`,
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

/**
 * Projects ARIA attributes and classes for the multiselect field parts (per-option chip parts are
 * built by the controller, same split option-field-controller.ts uses).
 *
 * The options live in an overlay, like every other popup widget in the catalog: `trigger` is what
 * the user sees and operates, `popup` is the panel it controls, and `group` is the chip group
 * inside it. Laying the group out inline instead would reflow the page on every open.
 */
export function projectMultiselectFieldA11y<TValue>(
  state: MdyMultiselectFieldState<TValue>,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyMultiselectFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly trigger: MdyPartContract;
  readonly placeholder: MdyPartContract;
  readonly chips: MdyPartContract;
  readonly popup: MdyPartContract;
  readonly search: MdyPartContract;
  readonly group: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { labelId, groupId, triggerId, popupId, searchId, descriptionId, errorId } =
    multiselectFieldPartIds(options.widgetId);
  const hasErrors = errors.length > 0;
  const describedBy = hasErrors ? errorId : descriptionId;

  return {
    root: {
      classes: [
        ...multiselectFieldRootClasses(state),
        ...(state.open ? ["mdy-renderer--open"] : []),
      ],
      attributes: {},
    },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: {
        for: triggerId,
      },
    },
    trigger: {
      id: triggerId,
      classes: ["mdy-multiselect"],
      attributes: {
        "aria-haspopup": "listbox",
        // A string, not a boolean: `aria-expanded="false"` is a state, and dropping the attribute
        // leaves the trigger with a required one missing.
        "aria-expanded": String(state.open),
        "aria-controls": popupId,
        "aria-labelledby": labelId,
        "aria-invalid": String(hasErrors),
        "aria-required": String(state.required),
        "aria-disabled": String(state.disabled),
        "aria-describedby": describedBy,
        disabled: state.disabled,
      },
    },
    placeholder: {
      classes: ["mdy-multiselect__placeholder"],
      // Shown only while nothing is selected — the chips speak for themselves once there are any.
      attributes: { hidden: state.selectedKeys.size > 0 },
    },
    chips: {
      classes: ["mdy-multiselect__chips"],
      attributes: {},
    },
    popup: {
      id: popupId,
      classes: ["mdy-multiselect__dropdown"],
      attributes: { hidden: !state.open },
    },
    search: {
      id: searchId,
      classes: ["mdy-multiselect-overlay__input"],
      attributes: {
        "aria-controls": groupId,
        "aria-label": "Filter options",
        // The native attribute, so the question is reachability rather than writability. Filtering
        // does not change the value, so a user who may read the field must still be able to do it.
        disabled: blocksFocus(state.interactivity),
      },
    },
    group: {
      id: groupId,
      classes: ["mdy-multiselect__options"],
      attributes: {
        role: "group",
        "aria-labelledby": labelId,
        "aria-invalid": String(hasErrors),
        "aria-required": String(state.required),
        "aria-disabled": String(state.disabled),
        "aria-describedby": describedBy,
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
