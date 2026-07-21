/**
 * Headless single-select controller.
 */

import { vanillaReactivity } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/core/ui";
import type { MdyReactivity, MdySignal } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { defaultWidgetIdFactory } from "../ids.js";
import { projectSelectA11y } from "./select-a11y.js";
import { selectNextActiveKey } from "./select-keyboard.js";
import type { MdySelectOption } from "@modyra/core";

import type {
  MdySelectControllerOptions,
  MdySelectIntent,
  MdySelectState,
} from "./select-types.js";

export interface MdySelectController<TValue>
  extends MdyWidgetController<MdySelectState<TValue>, MdySelectIntent> {
  /** Set the selected value programmatically (e.g. from a form patch). */
  setValue(value: TValue | null): void;
  /** Replace the option list (e.g. async loading finished). */
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
  /** Update the open state programmatically without emitting commands. */
  setOpen(open: boolean): void;
  /** Update the disabled state. */
  setDisabled(disabled: boolean): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
  /** Update the invalid state. */
  setInvalid(invalid: boolean): void;
  /** Update the loading state. */
  setLoading(loading: boolean): void;
}

export function createSelectController<TValue>(
  options: MdySelectControllerOptions<TValue>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdySelectController<TValue> {
  const {
    widgetId,
    options: initialOptions,
    keyFor = (option) => String(option.value),
    value: initialValue = null,
    disabled: initialDisabled = false,
    readonly: initialReadonly = false,
    invalid: initialInvalid = false,
    loading: initialLoading = false,
    onChange,
  } = options;

  const idFactory = defaultWidgetIdFactory;
  const allOptions: MdySelectOption<TValue>[] = [...initialOptions];
  const optionByKey = new Map<string, MdySelectOption<TValue>>();
  const valueToKey = new Map<TValue, string>();

  function rebuildOptionIndex(): void {
    optionByKey.clear();
    valueToKey.clear();
    for (const option of allOptions) {
      const key = keyFor(option);
      optionByKey.set(key, option);
      valueToKey.set(option.value, key);
    }
  }
  rebuildOptionIndex();

  const keyForValue = (value: TValue | null): string | null =>
    value === null ? null : valueToKey.get(value) ?? null;

  const valueForKey = (key: string | null): TValue | null =>
    key === null ? null : optionByKey.get(key)?.value ?? null;

  const filteredOptions = (query: string) =>
    filterOptionsByQuery(allOptions, query);

  const visibleKeys = (query: string): readonly string[] =>
    filteredOptions(query).map(keyFor);

  const navigableKeys = (query: string): readonly string[] =>
    filteredOptions(query)
      .filter((o) => !o.disabled)
      .map(keyFor);

  const open = reactivity.signal(false);
  const query = reactivity.signal("");
  const activeKey = reactivity.signal<string | null>(null);
  const selectedKey = reactivity.signal<string | null>(keyForValue(initialValue));
  const disabled = reactivity.signal(initialDisabled);
  const readonly = reactivity.signal(initialReadonly);
  const invalid = reactivity.signal(initialInvalid);
  const touched = reactivity.signal(false);
  const dirty = reactivity.signal(false);
  const loading = reactivity.signal(initialLoading);

  const state: MdySignal<MdySelectState<TValue>> = reactivity.computed(() => ({
    open: open(),
    query: query(),
    activeKey: activeKey(),
    selectedValue: valueForKey(selectedKey()),
    selectedKey: selectedKey(),
    disabled: disabled(),
    readonly: readonly(),
    invalid: invalid(),
    touched: touched(),
    dirty: dirty(),
    loading: loading(),
  }));

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const q = query();
    const currentActiveKey = activeKey();
    const currentSelectedKey = selectedKey();
    const currentOpen = open();
    const a11y = projectSelectA11y({
      widgetId,
      open: currentOpen,
      activeKey: currentActiveKey,
      selectedKey: currentSelectedKey,
      disabled: disabled(),
      readonly: readonly(),
      invalid: invalid(),
      loading: loading(),
      idFactory,
      visibleKeys: visibleKeys(q),
    });

    const parts: Record<string, ReturnType<typeof a11y.option>> = {};
    for (const option of allOptions) {
      const key = keyFor(option);
      parts[key] = a11y.option(key);
    }

    return {
      root: a11y.trigger,
      parts: {
        trigger: a11y.trigger,
        listbox: a11y.listbox,
        ...parts,
      },
    };
  });

  function setActive(key: string | null, commands: MdyUiCommand[]): void {
    activeKey.set(key);
    if (key) {
      commands.push({
        type: "scroll-into-view",
        target: { part: "option", key },
      });
    }
  }

  function selectKey(key: string | null, commands: MdyUiCommand[]): void {
    if (key !== null && optionByKey.get(key)?.disabled) return;
    selectedKey.set(key);
    dirty.set(true);
    commands.push({ type: "emit-change" });
    onChange?.(valueForKey(key));
  }

  function close(restoreFocus: boolean, commands: MdyUiCommand[]): void {
    if (!open()) return;
    open.set(false);
    activeKey.set(null);
    query.set("");
    commands.push({ type: "close-overlay" });
    if (restoreFocus) {
      commands.push({
        type: "restore-focus",
        target: { part: "trigger" },
      });
    }
  }

  function dispatch(intent: MdySelectIntent): readonly MdyUiCommand[] {
    const commands: MdyUiCommand[] = [];

    if (disabled() || readonly()) {
      if (intent.type === "blur") {
        touched.set(true);
        commands.push({ type: "mark-touched" });
      }
      return commands;
    }

    switch (intent.type) {
      case "open": {
        if (!open()) {
          open.set(true);
          const keys = navigableKeys(query());
          const next =
            selectedKey() && keys.includes(selectedKey()!)
              ? selectedKey()
              : keys[0] ?? null;
          setActive(next, commands);
          commands.push({
            type: "open-overlay",
            anchor: { part: "trigger" },
          });
        }
        break;
      }
      case "close": {
        close(intent.restoreFocus, commands);
        break;
      }
      case "move": {
        if (!open()) {
          open.set(true);
          commands.push({
            type: "open-overlay",
            anchor: { part: "trigger" },
          });
        }
        const next = selectNextActiveKey(
          intent.target,
          activeKey(),
          navigableKeys(query()),
        );
        if (next !== null) {
          setActive(next, commands);
        }
        break;
      }
      case "select": {
        selectKey(intent.optionKey, commands);
        close(true, commands);
        break;
      }
      case "search": {
        query.set(intent.query);
        const keys = navigableKeys(intent.query);
        const next = keys[0] ?? null;
        if (!open()) {
          open.set(true);
          commands.push({
            type: "open-overlay",
            anchor: { part: "trigger" },
          });
        }
        setActive(next, commands);
        break;
      }
      case "blur": {
        touched.set(true);
        close(true, commands);
        commands.push({ type: "mark-touched" });
        break;
      }
      case "focus": {
        // No state change required; adapter may track focus visually.
        break;
      }
    }

    return commands;
  }

  function setValue(value: TValue | null): void {
    selectedKey.set(keyForValue(value));
  }

  function setOptions(nextOptions: readonly MdySelectOption<TValue>[]): void {
    allOptions.length = 0;
    for (const option of nextOptions) {
      allOptions.push(option);
    }
    rebuildOptionIndex();
    // Re-validate selected value against new options.
    const currentKey = selectedKey();
    if (currentKey !== null && !optionByKey.has(currentKey)) {
      selectedKey.set(null);
    }
  }

  function setOpen(nextOpen: boolean): void {
    open.set(nextOpen);
    if (!nextOpen) {
      activeKey.set(null);
      query.set("");
    }
  }

  function setDisabled(nextDisabled: boolean): void {
    disabled.set(nextDisabled);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function setInvalid(nextInvalid: boolean): void {
    invalid.set(nextInvalid);
  }

  function setLoading(nextLoading: boolean): void {
    loading.set(nextLoading);
  }

  function destroy(): void {
    // Signals are released by dropping references; no effects to clean here.
  }

  return {
    state,
    view,
    dispatch,
    setValue,
    setOptions,
    setOpen,
    setDisabled,
    setReadonly,
    setInvalid,
    setLoading,
    destroy,
  };
}
