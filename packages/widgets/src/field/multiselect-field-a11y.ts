/**
 * Accessibility projection for the multiselect field widget.
 *
 * The options are a group of toggle buttons — `role="group"` with `aria-pressed` on each chip — not
 * a listbox. A listbox announces "N of M selected" and expects a single roving focus through a list
 * the user opens; these chips are all on screen at once and each is independently on or off, which
 * is what a pressed toggle already means.
 */
import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import { blocksFocus } from "../interactivity.js";
import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
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
    errorId: `${widgetId}__errors`,
  };
}

/** Computes the public state classes for the multiselect field root. */
export function multiselectFieldRootClasses<TValue>(state: MdyMultiselectFieldState<TValue>): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
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
        ...projectOverlayOpenerA11y("multiselect", { widgetId: options.widgetId, open: state.open })
          ?.attributes,
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
        // `role="group"` supports neither `aria-invalid` nor `aria-required`: they say something
        // about a value, and a group holds no value. `aria-invalid` moves to the trigger, which
        // supports it.
        //
        // `aria-required` has nowhere to go on this widget, and that is a gap rather than an
        // oversight. The chips are toggle buttons in a group by deliberate choice (see the note at
        // the top of this file), and neither `group` nor `button` supports the attribute — so the
        // requirement reaches assistive technology through nothing. It did not before either: an
        // attribute a role does not support is not announced, so writing it here only produced
        // markup axe reports as critical. Closing it needs a visually-hidden "required" in the label,
        // which is shared CSS this package does not own yet.
        role: "group",
        "aria-labelledby": labelId,
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
        // A live region and nothing more. This used to carry `role="alert"` as well, which replaced
        // the list semantics of the <ul> it sits on — axe reports every <li> inside such a list as an
        // orphaned list item, and a screen reader sees the same thing. `aria-live` already announces
        // the list when it appears, so the role added nothing and cost the structure.
        "aria-live": "polite",
      },
    },
  };
}
