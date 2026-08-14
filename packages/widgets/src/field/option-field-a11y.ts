/**
 * Accessibility projection for option-based field widgets (radio / segmented).
 */

import type { MdyFieldError } from "@modyra/core";
import type { MdyPartContract } from "../contract.js";
import { MDY_CSS_PROPERTIES } from "../css.js";
import { MDY_FIELD_STATE_CLASSES, MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import { shownErrors } from "./verdict.js";
import type {
  MdyOptionFieldState,
  MdyOptionFieldVariant,
} from "./option-field-types.js";

export interface MdyOptionFieldA11yOptions {
  readonly widgetId: string;
  readonly variant: MdyOptionFieldVariant;
  /** How many options the group renders. The segmented theme sizes its tick gutter from it. */
  readonly optionCount: number;
  /**
   * Whether the error list is actually in the document.
   *
   * The caller owns this because only the caller knows when it renders one. A renderer that defers
   * the list until the field is touched has errors long before it shows them, and deriving this
   * from `errors.length` makes `aria-describedby` name an element that is not in the document.
   *
   * Defaults to "there are errors", which is correct for a renderer that always shows them.
   */
  readonly errorsVisible?: boolean;
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
    errorId: `${widgetId}__errors`,
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
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error
  // text renders are four faces of one question, answered once in verdict.ts.
  const hasErrors = shownErrors(state, errors).length > 0;
  // What the group describes itself by depends on what was *rendered*, not on what is wrong.
  const describedBy = (options.errorsVisible ?? hasErrors) ? errorId : descriptionId;

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
        // No read-only. A radio group and a segmented control are choosers, and
        // `MDY_WIDGET_STATE_SUPPORT` does not list the state for either: there is no read-only
        // rendering of "pick one of these", only an operable one and a disabled one. Announcing
        // `aria-readonly="true"` on the group made read-only look like a meaningful axis for a
        // widget where nothing implements it.
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
        // A live region and nothing more. `role="alert"` here would override the list semantics of
        // the <ul> it sits on: axe reports every <li> inside such a list as an orphaned list item, and
        // a screen reader sees the same thing. `aria-live` announces the list when it appears, so the
        // role would cost the structure and add nothing.
        "aria-live": "polite",
      },
    },
  };
}
