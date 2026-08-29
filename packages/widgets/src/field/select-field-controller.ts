/**
 * A select bound to a form field.
 *
 * The select controller was the one kind built the other way round: it takes options, a value and a
 * callback, and a host drives it with eight imperative setters. Every other kind takes a field handle
 * and reads it. Two idioms in one package meant a renderer picked whichever the kind happened to
 * have — and `multiselect`, which is the same widget with more than one answer, sat on the opposite
 * side of the split from `select`.
 *
 * This is the adapter that closes it, in the direction that costs nothing: a form-shaped controller
 * on top of the standalone one. The standalone controller keeps working for a host that has no form
 * — which is the case it was written for and the reason it is not simply replaced.
 *
 * The verdict rule arrives with the binding: a select's `invalid` was a boolean its caller passed,
 * so a field the form was not asking about painted as failing unless the caller happened to know
 * better. It reads it from the handle now.
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity, type MdySelectOption, type MdySignal } from "@modyra/core";
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { createSelectController } from "../select/select-controller.js";
import type { MdySelectIntent, MdySelectState } from "../select/select-types.js";
import { engageValue, visibleErrorsOf } from "./verdict.js";

export interface MdySelectFieldControllerOptions<TValue> {
  readonly widgetId: string;
  readonly handle: MdyFieldHandle<TValue | null>;
  readonly options: readonly MdySelectOption<TValue>[];
  readonly keyFor?: (option: MdySelectOption<TValue>) => string;
  /** Whether options are still arriving. Not a form state, so it stays a parameter. */
  readonly loading?: boolean;
  readonly readonly?: boolean;
}

export interface MdySelectFieldController<TValue>
  extends MdyWidgetController<MdySelectState<TValue>, MdySelectIntent> {
  /** Which of the two texts under the field the trigger describes itself by. */
  setDescribedBy(shown: { readonly errorsVisible?: boolean; readonly descriptionVisible?: boolean }): void;
  /** Whether the panel is up. */
  setOpen(open: boolean): void;
  /** Whether the panel's contents are in the document — a renderer may build them only on open. */
  setPopupRendered(rendered: boolean): void;
  /** Replace the offered options — a list that arrives after the control is on screen. */
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
  setLoading(loading: boolean): void;
  setReadonly(readonly: boolean): void;
}

export function createSelectFieldController<TValue>(
  options: MdySelectFieldControllerOptions<TValue>,
  reactivity?: MdyReactivity,
): MdySelectFieldController<TValue> {
  const rx = observerFor(options.handle, reactivity);
  const { handle } = options;

  const inner = createSelectController<TValue>({
    widgetId: options.widgetId,
    options: options.options,
    keyFor: options.keyFor,
    value: handle.value(),
    disabled: handle.disabled(),
    readonly: handle.readonly() || (options.readonly ?? false),
    // What is *shown*, not what is wrong — the same question the binding below asks, so the first
    // paint and every one after it agree. See ADR 0165.
    invalid: visibleErrorsOf(handle, "select").length > 0,
    required: handle.required(),
    loading: options.loading ?? false,
    onChange: (value) => {
      handle.set(value);
      engageValue(handle);
    },
  }, rx);

  /**
   * The form drives the controller, not the other way round.
   *
   * Without this the setters are the only way in, and a value changed anywhere else — a draft
   * restored, a server correction, another control's cross-field rule — never reaches the widget.
   */
  const bound = rx.effect(() => {
    inner.setValue(handle.value());
    inner.setDisabled(handle.disabled());
    inner.setReadonly(handle.readonly() || (options.readonly ?? false));
    // `aria-invalid` is a verdict on an act, not a state. A field that is empty and never touched
    // holds nothing, so there is nothing wrong with it — it is not filled in yet, and `required` is
    // the word for that. A field that arrived already holding something wrong says so at once,
    // touched or not, because a draft nobody is told about is a draft that gets resent. Both are
    // `visibleErrorsOf`, which is why it is one call rather than two rules. ADR 0165.
    inner.setInvalid(visibleErrorsOf(handle, "select").length > 0);
    // The field's own rule, told to a control that has none: a combobox is not a native input and
    // announces nothing about being required unless it is said.
    inner.setRequired(handle.required());
  });

  const state: MdySignal<MdySelectState<TValue>> = inner.state;
  const view: MdySignal<MdyWidgetViewContract> = inner.view;

  return {
    state,
    view,
    dispatch(intent: MdySelectIntent): readonly MdyUiCommand[] {
      return inner.dispatch(intent);
    },
    setOptions: inner.setOptions,
    setLoading: inner.setLoading,
    /**
     * The three facts only the renderer has, forwarded rather than decided.
     *
     * Which of the two texts under the field is on screen; whether the panel is up; whether the
     * panel's contents are in the document at all — a renderer that builds them on open has nothing
     * for `aria-controls` to name while closed. None of the three is a contract question, and not
     * forwarding them is what kept every renderer on the standalone controller.
     */
    setDescribedBy: inner.setDescribedBy,
    setOpen: inner.setOpen,
    setPopupRendered: inner.setPopupRendered,
    setReadonly(readonly: boolean): void {
      inner.setReadonly(handle.readonly() || readonly);
    },
    destroy(): void {
      bound.destroy();
      inner.destroy();
    },
  };
}
