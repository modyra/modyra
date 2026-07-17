/**
 * Headless option-based field controller (radio group / segmented).
 */

import type { MdyReactivity, MdySelectOption, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectOptionFieldA11y } from "./option-field-a11y.js";
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
}

export function createOptionFieldController<TValue>(
  options: MdyOptionFieldControllerOptions<TValue>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyOptionFieldController<TValue> {
  const {
    widgetId,
    handle,
    options: allOptions,
    keyFor = (option) => String(option.value),
    variant = "radio",
    readonly: initialReadonly = false,
  } = options;

  const optionByKey = new Map<string, MdySelectOption<TValue>>();
  function rebuildIndex(): void {
    optionByKey.clear();
    for (const option of allOptions) {
      optionByKey.set(keyFor(option), option);
    }
  }
  rebuildIndex();

  const keyForValue = (value: TValue | null): string | null =>
    value === null ? null : [...optionByKey.entries()].find(([, o]) => o.value === value)?.[0] ?? null;

  const enabledKeys = (): readonly string[] =>
    allOptions.filter((o) => !o.disabled).map(keyFor);

  const readonly = reactivity.signal(initialReadonly);
  const selectedKey = reactivity.signal<string | null>(keyForValue(handle.value()));
  const activeKey = reactivity.signal<string | null>(null);

  const state: MdySignal<MdyOptionFieldState<TValue>> = reactivity.computed(() => ({
    selectedValue: handle.value(),
    selectedKey: selectedKey(),
    invalid: !handle.valid(),
    disabled: handle.disabled(),
    readonly: readonly(),
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
    });

    const parts: Record<string, ReturnType<typeof a11yOption>> = {};
    for (const option of allOptions) {
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
        ...(option.disabled || currentState.disabled || currentState.readonly
          ? [variant === "segmented" ? "mdy-segmented__button--disabled" : "mdy-radio-item--disabled"]
          : []),
      ],
      attributes: {
        role: "radio",
        "aria-checked": selected,
        "aria-disabled": option.disabled || currentState.disabled || currentState.readonly,
        disabled: option.disabled || currentState.disabled,
      },
    };
  }

  function selectKey(key: string | null): readonly MdyUiCommand[] {
    if (key === null) return [];
    const option = optionByKey.get(key);
    if (!option || option.disabled) return [];
    selectedKey.set(key);
    handle.set(option.value);
    handle.markAsDirty();
    handle.markAsTouched();
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
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }

    if (state().disabled || state().readonly) {
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
    selectedKey.set(keyForValue(value));
    handle.set(value);
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
    destroy,
  };
}
