/**
 * Accessibility projection for primitive field widgets.
 */
import type { MdyValueKind, MdyFieldError } from "@modyra/core";
import { defaultWidgetIdFactory as idFactory, assertUsableWidgetId } from "../ids.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES } from "../structure.js";
import type { MdyFieldState } from "./field-types.js";
import type { MdyFieldConstraints } from "@modyra/core";
import { MDY_WIDGET_KINDS, type MdyWidgetKind } from "../catalog.js";
import { widgetSupportsState } from "../widget-states.js";
import { projectFieldShellA11y } from "./shell-a11y.js";
import { errorsVisible, holdsUneditedValue } from "./verdict.js";
export interface MdyTextFieldA11yOptions {
  readonly widgetId: string;
  readonly inputType?: string;
  readonly inputMode?: string;
  readonly autocomplete?: string;
  /**
   * The kind whose control this is, so the projection can decide which native constraints it can
   * carry — a `maxlength` on a number input is ignored by the platform, and a `pattern` on a
   * textarea likewise.
   */
  readonly kind?: MdyWidgetKind | string;
  /**
   * What the field's rules state, already narrowed by anything the control itself asks for.
   *
   * The projection is where a control's attributes are decided — `type`, `inputmode`, the ARIA set
   * — so this is where the rules become attributes too. A renderer that had to place them itself
   * would be a renderer that could forget one, and two of them did.
   */
  readonly constraints?: MdyFieldConstraints;
}

/** Builds the static IDs used by a field widget view. */
export function textFieldPartIds(widgetId: string): {
  readonly inputId: string;
  readonly labelId: string;
  readonly descriptionId: string;
  readonly errorId: string;
} {
  assertUsableWidgetId(widgetId);
  return {
    inputId: widgetId,
    labelId: idFactory.part(widgetId, "label"),
    descriptionId: idFactory.part(widgetId, "description"),
    errorId: idFactory.part(widgetId, "errors"),
  };
}

/** Computes the public state classes for the field root. */
export function textFieldRootClasses<TValue>(state: MdyFieldState<TValue>): readonly string[] {
  const S = MDY_FIELD_STATE_CLASSES;
  return [
    S.field,
    ...S.fieldStates
      .filter((name: string) => Boolean((state as unknown as Record<string, unknown>)[name]))
      .map((name: string) => `${S.field}--${name}`),
  ];
}

/** Projects ARIA attributes and classes for the field parts. */
export function projectTextFieldA11y<TValue>(
  state: MdyFieldState<TValue>,
  errors: ReadonlyArray<MdyFieldError>,
  options: MdyTextFieldA11yOptions,
): {
  readonly root: MdyPartContract;
  readonly label: MdyPartContract;
  readonly input: MdyPartContract;
  readonly description: MdyPartContract;
  readonly error: MdyPartContract;
} {
  const { inputId, labelId, descriptionId, errorId } = textFieldPartIds(options.widgetId);
  // Out of play, no verdict — the wrapper, the label, `aria-invalid` and whether the error
  // text renders are four faces of one question, answered once in verdict.ts.
  // Whether the person is being told yet. A rule they have not answered waits for them to reach the
  // field; a refusal about the value already there does not, because they can neither cause it by
  // inaction nor see the reason unless it is said.
  const tellingThem = errorsVisible({ disabled: state.disabled, touched: state.touched, holdsUnedited: holdsUneditedValue(state, options.kind as MdyValueKind | undefined) }, errors);
  // Whether this kind admits read-only at all, asked of the contract. A kind this contract does not
  // know is not this contract's to police: a consumer rendering their own kind keeps what they had.
  const kind = options.kind;
  const announcesReadonly = kind === undefined
    || !(MDY_WIDGET_KINDS as readonly string[]).includes(kind)
    || widgetSupportsState(kind as MdyWidgetKind, "readonly");
  // And whether the platform acts on the attribute, which is a different question. HTML honours
  // `readonly` on a text-entry control and ignores it on a range — so a slider announces read-only
  // and does not bind it: an attribute the browser drops is the appearance of a guarantee with
  // nothing behind it, and what refuses the drag is the renderer asking `blocksValueChange`.
  const bindsNativeReadonly = announcesReadonly && kind !== "slider";

  return {
    root: {
      classes: textFieldRootClasses(state),
      attributes: {},
    },
    label: {
      id: labelId,
      classes: [MDY_FIELD_SHELL_CLASSES.label],
      attributes: {
        for: inputId,
      },
    },
    input: {
      id: inputId,
      classes: [],
      attributes: {
        // What the control is, and what this projection alone knows: the kind's input type, the
        // autocomplete a caller asked for, and the two native flags.
        type: options.inputType ?? "text",
        autocomplete: options.autocomplete ?? null,
        // Everything a control exposes about its *state and rules* comes from the shell projection,
        // which is where a renderer that binds a part reads it. Two projections spelling the same
        // attributes is how they come to disagree — so this one asks rather than repeats.
        ...projectFieldShellA11y(
          { disabled: state.disabled, required: state.required },
          errors,
          {
            widgetId: options.widgetId,
            kind: options.kind ?? options.inputType,
            constraints: options.constraints,
            errorsVisible: tellingThem,
            descriptionVisible: true,
          },
        ).control.attributes,
        // The shell has no notion of read-only: it is a state only some kinds admit, and the field
        // projection is the one that knows whether this control does — asked of the contract rather
        // than assumed from the file the projection lives in. A slider is drawn by this same
        // projection and declares no read-only state, so it was announcing one: the state belongs to
        // the kind, not to the function that happens to draw it.
        "aria-readonly": announcesReadonly && state.readonly ? "true" : null,
        inputmode: options.inputMode ?? options.constraints?.inputMode ?? null,
        disabled: state.disabled,
        readonly: bindsNativeReadonly && state.readonly,
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
