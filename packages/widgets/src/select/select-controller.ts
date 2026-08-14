/**
 * Headless single-select controller.
 */

import { vanillaReactivity } from "@modyra/core";
import { filterOptionsByQuery, defaultOptionKey } from "../options-utils.js";
import type { MdyReactivity, MdySignal } from "@modyra/core";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { defaultWidgetIdFactory } from "../ids.js";
import { projectSelectA11y } from "./select-a11y.js";
import { selectNextActiveKey } from "./select-keyboard.js";
import { optionsWithUnrecognizedValue } from "../options-reconciliation.js";
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
  /** Which of the field's descriptions are on screen, so the trigger names one that exists. */
  setDescribedBy(next: { errorsVisible?: boolean; descriptionVisible?: boolean }): void;
  /** Whether the listbox is mounted, so the trigger controls something that exists. */
  setPopupRendered(rendered: boolean): void;
}

export function createSelectController<TValue>(
  options: MdySelectControllerOptions<TValue>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdySelectController<TValue> {
  const {
    widgetId,
    options: initialOptions,
    keyFor = (option) => defaultOptionKey(option.value),
    value: initialValue = null,
    disabled: initialDisabled = false,
    readonly: initialReadonly = false,
    invalid: initialInvalid = false,
    loading: initialLoading = false,
    onChange,
  } = options;

  const idFactory = defaultWidgetIdFactory;
  /** What the caller declared. */
  const allOptions: MdySelectOption<TValue>[] = [...initialOptions];
  /**
   * What is painted: the declared list, plus a held value the list does not contain.
   *
   * A signal rather than a variable: the list changes when options are replaced *and* when the
   * selection moves, and everything drawn from it — the state, the filtered list, the view's parts
   * — has to be told. It used to be told by accident, because replacing the options cleared the
   * selection; keeping the selection removed that accident.
   */
  const paintedOptions = reactivity.signal<readonly MdySelectOption<TValue>[]>(allOptions);
  const optionByKey = new Map<string, MdySelectOption<TValue>>();
  const valueToKey = new Map<TValue, string>();
  /**
   * The label each key was last painted with.
   *
   * A value the list stops offering is kept — that is this widget's rule — and it has to be shown as
   * something a user can read. The list held that option a moment ago, so its own label is the
   * honest name for it: a refetch that drops Ada leaves "Ada" on screen rather than a stringified
   * value. A value that was never in any list, from a draft or a patch, falls back to the shared
   * readable form.
   */
  const labelSeen = new Map<string, string>();

  function rebuildOptionIndex(selected: TValue | null): void {
    const painted = optionsWithUnrecognizedValue(
      allOptions,
      selected,
      (value) => labelSeen.get(keyFor({ value, label: "" } as MdySelectOption<TValue>)) ?? readableFallback(value),
    );
    paintedOptions.set(painted);
    optionByKey.clear();
    valueToKey.clear();
    for (const option of painted) {
      const key = keyFor(option);
      optionByKey.set(key, option);
      valueToKey.set(option.value, key);
      labelSeen.set(key, option.label);
    }
  }
  rebuildOptionIndex(initialValue);

  const keyForValue = (value: TValue | null): string | null =>
    value === null ? null : valueToKey.get(value) ?? null;

  const valueForKey = (key: string | null): TValue | null =>
    key === null ? null : optionByKey.get(key)?.value ?? null;

  const filteredOptions = (query: string) =>
    filterOptionsByQuery(paintedOptions(), query);

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
  // What the trigger may describe itself by. The renderer owns the answer because it owns whether
  // the elements are on screen; the default is the resting field — a description and no errors.
  const errorsVisible = reactivity.signal(false);
  const descriptionVisible = reactivity.signal(true);
  // Eager by default: the popup is in the document whether or not it is open, which is what every
  // renderer did before a lazily-mounted one existed.
  const popupRendered = reactivity.signal(true);

  const state: MdySignal<MdySelectState<TValue>> = reactivity.computed(() => ({
    options: paintedOptions(),
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
      errorsVisible: errorsVisible(),
      descriptionVisible: descriptionVisible(),
      popupRendered: popupRendered(),
    });

    const parts: Record<string, ReturnType<typeof a11y.option>> = {};
    // What the state paints, not what the caller declared. `MdySelectState.options` says a renderer
    // paints *this* rather than the list it was handed — so building parts from the declared list
    // left the survivor with no part: an element inside a listbox with no id, no `role="option"`
    // and no `aria-selected`, and the one entry the user needs in order to replace their value.
    for (const option of paintedOptions()) {
      const key = keyFor(option);
      parts[key] = a11y.option(key);
    }

    return {
      root: a11y.trigger,
      parts: {
        trigger: a11y.trigger,
        search: a11y.search,
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
        // A closed list has nothing to move through, and opening here would be a second way to open
        // beside the keyboard policy — which already answers `ArrowDown` on a collapsed combobox
        // with `open`. Two paths to one behaviour means neither can be changed on its own — remove
        // the policy's rule and this one still opens, leaving the suite green on a contract that no
        // longer says so.
        if (!open()) break;
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
      case "activate": {
        // Only over what is navigable: activating a filtered-out option would point
        // `aria-activedescendant` at an element that is not in the list.
        if (!open()) break;
        if (navigableKeys(query()).includes(intent.optionKey)) {
          setActive(intent.optionKey, commands);
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
        // Closes without restoring focus. Focus has already gone where the user sent it — a Tab, a
        // click on another control — and pulling it back to the trigger takes it off whatever they
        // just reached for. Escape is the opposite case and restores deliberately: there the user
        // is still in the widget and has nowhere else to be.
        close(false, commands);
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
    // The index is rebuilt around the value, so a value the declared options do not contain gets an
    // option of its own — and therefore a key, a chip and a way for the user to replace it.
    rebuildOptionIndex(value);
    selectedKey.set(keyForValue(value));
  }

  function setOptions(nextOptions: readonly MdySelectOption<TValue>[]): void {
    const selected = valueForKey(selectedKey());
    allOptions.length = 0;
    for (const option of nextOptions) {
      allOptions.push(option);
    }
    // The selection survives the list changing: options arriving, being filtered or being replaced
    // are not a user edit, and a value the new list does not name keeps an option of its own rather
    // than being dropped. What refuses such a value is a rule — `oneOf` — not the widget.
    rebuildOptionIndex(selected);
    selectedKey.set(keyForValue(selected));
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

  function setDescribedBy(next: { errorsVisible?: boolean; descriptionVisible?: boolean }): void {
    if (next.errorsVisible !== undefined) errorsVisible.set(next.errorsVisible);
    if (next.descriptionVisible !== undefined) descriptionVisible.set(next.descriptionVisible);
  }

  function setPopupRendered(rendered: boolean): void {
    popupRendered.set(rendered);
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
    setDescribedBy,
    setPopupRendered,
    destroy,
  };
}

/** A value with no option to name it: readable, and never `[object Object]`. */
function readableFallback(value: unknown): string {
  return typeof value === "object" && value !== null ? defaultOptionKey(value) : String(value);
}
