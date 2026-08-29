/**
 * Headless option-based field controller (radio group / segmented).
 */

import { blocksFocus, blocksValueChange } from "../interactivity.js";
import { engageValue, fieldCanBeInvalid } from "./verdict.js";
import { optionsWithUnrecognizedValue } from "../options-reconciliation.js";
import type { MdyReactivity, MdySelectOption, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectOptionFieldA11y } from "./option-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
import type {
  MdyOptionFieldControllerOptions,
  MdyOptionFieldIntent,
  MdyOptionFieldState,
} from "./option-field-types.js";

export interface MdyOptionFieldController<TValue>
  extends MdyWidgetController<MdyOptionFieldState<TValue>, MdyOptionFieldIntent> {
  /** Set the selected value programmatically without producing a command. */
  setValue(value: TValue | null): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
  /**
   * Replace the option list.
   *
   * A host whose options arrive later, or change, tells the controller rather than building a new
   * one: a fresh controller forgets which option the keyboard was on, so a list that reorders
   * beneath an open group would drop the roving focus.
   */
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
}

export function createOptionFieldController<TValue>(
  options: MdyOptionFieldControllerOptions<TValue>,
  reactivity?: MdyReactivity,
): MdyOptionFieldController<TValue> {
  // Observed through the runtime that owns the handle. A caller that supplies one keeps it
  // and is told when it does not match — a fresh runtime over another form's handle is the
  // defect this registry was added for, and it fails by rendering nothing rather than by
  // raising.
  reactivity = observerFor(options.handle, reactivity);
  const {
    widgetId,
    handle,
    options: initialOptions,
    keyFor = (option) => String(option.value),
    variant = "radio",
    readonly: initialReadonly = false,
  } = options;

  // The list is a signal because the projection and the roving focus both read it: a host that
  // replaces it has to move every derived answer with it, not just the next lookup.
  const optionList = reactivity.signal<readonly MdySelectOption<TValue>[]>(initialOptions);
  /**
   * The options this control paints: the declared list, plus the held value when the list does not
   * offer it.
   *
   * `options-reconciliation` names its own scope — *"Any control that offers a list faces this: a
   * form holds `"fr"`, the options arrive without it, and the control has to show something"* — and
   * a radio group is such a control. Without this it painted nothing for the value it was holding:
   * an unanswered question that has an answer, kept through a submit the user cannot see.
   *
   * The phantom entry is the price and it is the smaller one. A group with an extra radio the list
   * did not declare is legible and correctable; a group silently holding a value it does not show is
   * neither.
   */
  const allOptions = (): readonly MdySelectOption<TValue>[] =>
    optionsWithUnrecognizedValue(optionList(), handle.value());

  const optionByKey = new Map<string, MdySelectOption<TValue>>();
  function rebuildIndex(): void {
    optionByKey.clear();
    for (const option of allOptions()) {
      optionByKey.set(keyFor(option), option);
    }
  }
  rebuildIndex();

  const keyForValue = (value: TValue | null): string | null =>
    value === null ? null : [...optionByKey.entries()].find(([, o]) => o.value === value)?.[0] ?? null;

  const enabledKeys = (): readonly string[] =>
    allOptions().filter((o) => !o.disabled).map(keyFor);

  const readonly = reactivity.signal(initialReadonly);
  /**
   * Which option is chosen, derived rather than copied.
   *
   * It was a signal seeded from the value and written beside every `handle.set` — which carries no
   * information the value does not, since selecting always writes both. What it did carry was the
   * chance of disagreeing: a value written from anywhere else — a draft restored, a server
   * response, `patch()` — left the state reporting the live value beside a stale key, and a
   * renderer checks the radio from the key.
   */
  const selectedKey = reactivity.computed(() => keyForValue(handle.value()));
  const activeKey = reactivity.signal<string | null>(null);

  const state: MdySignal<MdyOptionFieldState<TValue>> = reactivity.computed(() => ({
    selectedValue: handle.value(),
    selectedKey: selectedKey(),
    // Out of play, no verdict: a disabled field is not validated by the form, so painting it as
    // failing would show a verdict the form itself ignores. See verdict.ts.
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
    disabled: handle.disabled(),
    // From the handle first, as `disabled` is: these are the two derived halves of one value, and
    // reading one from the form while the other waited for a host to call `setReadonly` is how a
    // field that refused every change announced nothing about it.
    readonly: handle.readonly() || readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    interactivity: handle.interactivity(),
    required: handle.required(),
    touched: handle.touched(),
    dirty: handle.dirty(),
    pending: handle.pending(),
  }));

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const currentActiveKey = activeKey();
    const a11y = projectOptionFieldA11y(currentState, handle.errors(), {
      widgetId,
      variant,
      optionCount: allOptions().length,
      // What the group is called where a document wrote no label. The controller has these because
      // a renderer has them; the rule for choosing between them is the contract's.
      label: options.label ?? null,
      ariaLabel: options.ariaLabel ?? null,
      fieldName: options.fieldName ?? handle.path ?? null,
      ...(options.errorsVisible ? { errorsVisible: options.errorsVisible(currentState) } : {}),
      // The error container is reserved under any field that can fail a rule — a fact about the
      // field, not about the renderer, so every renderer answers it from the same predicate.
      // Asked defensively: a handle is not obliged to offer either, and a controller that reads
      // both unguarded stops working for one that offers neither — which is a crash where the honest
      // answer is "this field declares no rule I can see".
      errorsReserved: fieldCanBeInvalid({
        required: handle.required?.() ?? false,
        constraints: handle.constraints?.() ?? null,
        disabled: handle.disabled?.() ?? false,
      }),
    });

    // A null prototype, because these keys are data: an option valued `__proto__` assigned into a
    // plain object sets that object's prototype instead of adding a member, so the part vanished and
    // the renderer was handed `undefined` — the control disappeared from the page mid-draw.
    const parts: Record<string, ReturnType<typeof a11yOption>> = Object.create(null);
    for (const option of allOptions()) {
      const key = keyFor(option);
      parts[key] = a11yOption(key, option, currentState, currentActiveKey);
    }

    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        group: a11y.group,
        description: a11y.description,
        error: a11y.error,
        ...parts,
      },
    };
  });

  function a11yOption(
    key: string,
    option: MdySelectOption<TValue>,
    currentState: MdyOptionFieldState<TValue>,
    currentActiveKey: string | null,
  ) {
    const selected = currentState.selectedKey === key;
    return {
      id: `${widgetId}__opt__${key}`,
      classes: [
        variant === "segmented" ? "mdy-segmented__button" : "mdy-radio-item",
        ...(selected ? [variant === "segmented" ? "mdy-segmented__button--selected" : "mdy-radio-item--selected"] : []),
        ...(currentActiveKey === key ? [variant === "segmented" ? "mdy-segmented__button--active" : "mdy-radio-item--active"] : []),
        ...(option.disabled || blocksValueChange(currentState.interactivity)
          ? [variant === "segmented" ? "mdy-segmented__button--disabled" : "mdy-radio-item--disabled"]
          : []),
      ],
      attributes: {
        role: "radio",
        // Not `aria-checked`. Every renderer draws this option as a native `<input type="radio">` —
        // a segmented button is one wearing a styled label — and a native radio maps its own
        // `checked` into the accessibility tree. The attribute beside it is a second source for one
        // fact, and when the two disagree the ARIA one wins and is the one that went stale. `null`
        // rather than an absent key: this contract says "no attribute" that way.
        "aria-checked": null,
        "aria-disabled": String(option.disabled || blocksFocus(currentState.interactivity)),
        // The native attribute asks the focus question. An option group has no read-only rendering,
        // so this differs from `aria-disabled` above only when a host sets the state directly.
        disabled: option.disabled || blocksFocus(currentState.interactivity),
      },
    };
  }

  function selectKey(key: string | null): readonly MdyUiCommand[] {
    if (key === null) return [];
    const option = optionByKey.get(key);
    if (!option || option.disabled) return [];
    handle.set(option.value);
    engageValue(handle);
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function move(target: "next" | "previous" | "first" | "last"): void {
    const keys = enabledKeys();
    if (keys.length === 0) return;
    const current = activeKey();
    let index = current === null ? -1 : keys.indexOf(current);

    switch (target) {
      case "next":
        index = Math.min(index + 1, keys.length - 1);
        break;
      case "previous":
        index = current === null ? 0 : Math.max(index - 1, 0);
        break;
      case "first":
        index = 0;
        break;
      case "last":
        index = keys.length - 1;
        break;
    }

    activeKey.set(keys[index] ?? null);
  }

  function dispatch(intent: MdyOptionFieldIntent): readonly MdyUiCommand[] {
    // A leaving is not an answer. Focus arriving and going is an act on attention: Tab is how a
    // person reads a form, and a form that treats reading as declining moves false news onto the
    // fields somebody was about to fill in. What makes this field answerable is a change to its
    // value, which `engageValue` records. ADR 0167.
    if (intent.type === "blur") return [];

    if (blocksValueChange(state().interactivity)) {
      return [];
    }

    switch (intent.type) {
      case "select": {
        return selectKey(intent.optionKey);
      }
      case "focus": {
        return [];
      }
      case "move": {
        move(intent.target);
        return [];
      }
    }
  }

  function setValue(value: TValue | null): void {
    handle.set(value);
  }

  function setOptions(next: readonly MdySelectOption<TValue>[]): void {
    optionList.set(next);
    rebuildIndex();
    // The selection follows the value on its own, because it is derived from it: a list replaced
    // under a chosen value keeps it selected while it is still offered, and selects nothing when it
    // is not.
    if (activeKey() !== null && !optionByKey.has(activeKey() as string)) activeKey.set(null);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return {
    state,
    view,
    dispatch,
    setValue,
    setReadonly,
    setOptions,
    destroy,
  };
}
