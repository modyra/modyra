/**
 * Headless multiselect field controller.
 *
 * Two selection semantics over one value, which is always an array. `"single"` is a toggle-set: an
 * option is in or out. `"multi"` lets the same option be taken more than once, so the value carries
 * repeats and the chip shows a count.
 *
 * Searching narrows what the host renders rather than what the field holds: `filteredOptions` is the
 * list to draw once a query exists, and the selection survives a query that hides it. The filter is
 * `filterOptionsByQuery`, shared with select so one search behaves the same in both.
 */
import { blocksFocus, blocksValueChange } from "../interactivity.js";
import type { MdyReactivity, MdySelectOption, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/core/ui";

import { overlayLifecycleTransition } from "../behavior.js";
import { optionsWithUnrecognizedValues } from "../options-reconciliation.js";
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectMultiselectFieldA11y } from "./multiselect-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
import type {
  MdyMultiselectFieldControllerOptions,
  MdyMultiselectFieldIntent,
  MdyMultiselectFieldState,
} from "./multiselect-field-types.js";

export interface MdyMultiselectFieldController<TValue>
  extends MdyWidgetController<MdyMultiselectFieldState<TValue>, MdyMultiselectFieldIntent> {
  /** Options remaining after `state().query` filters them, through the `filterOptionsByQuery`
   * search shared with select. Once a search intent has narrowed the list, the host renders this
   * rather than the full `options` array. */
  readonly filteredOptions: MdySignal<readonly MdySelectOption<TValue>[]>;
  /** Set the selected values programmatically without producing a command. */
  setValue(values: ReadonlyArray<TValue>): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
  /**
   * Replace the option list.
   *
   * A host whose options arrive later, or change, tells the controller rather than building a new
   * one: a fresh controller forgets the query and which option the keyboard was on.
   */
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
}

export function createMultiselectFieldController<TValue>(
  options: MdyMultiselectFieldControllerOptions<TValue>,
  reactivity?: MdyReactivity,
): MdyMultiselectFieldController<TValue> {
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
    mode = "single",
    readonly: initialReadonly = false,
  } = options;

  // The declared list is a signal because everything below is derived from it: what is painted,
  // what a query narrows, what the projection names. A host that replaces it moves all of them.
  const optionList = reactivity.signal<readonly MdySelectOption<TValue>[]>(initialOptions);
  const allOptions = (): readonly MdySelectOption<TValue>[] => optionList();

  /**
   * What this widget paints: the declared options, plus every held value they do not contain.
   *
   * Recomputed from the value, so a value that arrives after the widget was built — a record
   * loading, a draft coming back — brings its own option with it. Nothing is added while the list
   * is empty: options that have not loaded are not a list that refuses the value.
   */
  const effectiveOptions = reactivity.computed(() =>
    optionsWithUnrecognizedValues(allOptions(), handle.value()),
  );

  const indexOf = (options: readonly MdySelectOption<TValue>[]) => {
    const byKey = new Map<string, MdySelectOption<TValue>>();
    for (const option of options) byKey.set(keyFor(option), option);
    return byKey;
  };

  const keysOf = (
    values: ReadonlyArray<TValue>,
    byKey: ReadonlyMap<string, MdySelectOption<TValue>>,
  ): string[] =>
    values
      .map((value) => [...byKey.entries()].find(([, o]) => o.value === value)?.[0])
      .filter((key): key is string => key !== undefined);

  const readonly = reactivity.signal(initialReadonly);
  const query = reactivity.signal("");
  const open = reactivity.signal(false);

  const state: MdySignal<MdyMultiselectFieldState<TValue>> = reactivity.computed(() => {
    const selectedValues = handle.value();
    const options = effectiveOptions();
    const keys = keysOf(selectedValues, indexOf(options));
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    return {
      options,
      selectedValues,
      selectedKeys: new Set(keys),
      counts,
      query: query(),
      open: open(),
      // Out of play, no verdict: a disabled field is not validated by the form, so painting it as
    // failing would show a verdict the form itself ignores. See verdict.ts.
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
      disabled: handle.disabled(),
      // The form owns this state; `setReadonly()` is an imperative override for a renderer with no
    // form behind it.
    readonly: handle.readonly() || readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    //
    // The imperative override can only ever narrow what is permitted: `setReadonly()` serves a
    // renderer with no form behind it, and must not re-enable a field the form disabled.
    interactivity: handle.interactivity() === "enabled" && readonly()
      ? ("readonly" as const)
      : handle.interactivity(),
      required: handle.required(),
      touched: handle.touched(),
      dirty: handle.dirty(),
      pending: handle.pending(),
    };
  });

  const filteredOptions: MdySignal<readonly MdySelectOption<TValue>[]> = reactivity.computed(() =>
    filterOptionsByQuery(allOptions(), query()),
  );

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectMultiselectFieldA11y(currentState, handle.errors(), { widgetId });

    const parts: Record<string, ReturnType<typeof a11yOption>> = {};
    for (const option of allOptions()) {
      const key = keyFor(option);
      parts[key] = a11yOption(key, option, currentState);
    }

    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        trigger: a11y.trigger,
        placeholder: a11y.placeholder,
        chips: a11y.chips,
        popup: a11y.popup,
        search: a11y.search,
        group: a11y.group,
        description: a11y.description,
        error: a11y.error,
        ...parts,
      },
    };
  });

  function a11yOption(key: string, option: MdySelectOption<TValue>, currentState: MdyMultiselectFieldState<TValue>) {
    const selected = currentState.selectedKeys.has(key);
    const count = currentState.counts.get(key) ?? 0;
    const disabled = option.disabled || blocksValueChange(currentState.interactivity);
    // Filtering is the contract's: an option the query does not match is hidden here, so every
    // renderer filters identically by applying the part rather than reimplementing the match.
    const visible = filteredOptions().some((candidate) => keyFor(candidate) === key);
    return {
      id: `${widgetId}__opt__${key}`,
      // The shared chip vocabulary, projected once here so every
      // renderer draws the same chip: `--centered` reserves the check's width in toggle mode,
      // `--counter` is the bag mode with its step buttons.
      classes: [
        "mdy-chip",
        mode === "multi" ? "mdy-chip--counter" : "mdy-chip--centered",
        ...(selected ? ["mdy-chip--selected"] : []),
        ...(disabled ? ["mdy-chip--disabled"] : []),
      ],
      attributes: {
        ...(mode === "single" ? { "aria-pressed": String(selected) } : { "data-count": count }),
        "aria-disabled": String(disabled),
        hidden: !visible,
        // The native attribute asks the focus question, not the write question: a read-only chip
        // stays reachable.
        disabled: option.disabled || blocksFocus(currentState.interactivity),
      },
    };
  }

  function withOption(key: string, run: (option: MdySelectOption<TValue>) => readonly MdyUiCommand[]): readonly MdyUiCommand[] {
    // The painted list, not the declared one: a chip the user can see is a chip they can act on,
    // and the one standing for an unrecognised value is the only way to remove that value.
    const option = indexOf(effectiveOptions()).get(key);
    if (!option || option.disabled) return [];
    const commands = run(option);
    handle.markAsDirty();
    handle.markAsTouched();
    return commands;
  }

  function toggle(key: string): readonly MdyUiCommand[] {
    return withOption(key, (option) => {
      const values = [...handle.value()];
      const index = values.findIndex((v) => v === option.value);
      if (index === -1) values.push(option.value);
      else values.splice(index, 1);
      handle.set(values);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    });
  }

  function increment(key: string): readonly MdyUiCommand[] {
    return withOption(key, (option) => {
      handle.set([...handle.value(), option.value]);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    });
  }

  function decrement(key: string): readonly MdyUiCommand[] {
    const option = indexOf(effectiveOptions()).get(key);
    if (!option) return [];
    const values = [...handle.value()];
    const index = values.findIndex((v) => v === option.value);
    if (index === -1) return [];
    values.splice(index, 1);
    handle.set(values);
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function clear(): readonly MdyUiCommand[] {
    handle.set([]);
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  /**
   * Runs an overlay intent through the one lifecycle policy every popup widget shares, so
   * "does this open", "does focus return" never means something different here.
   */
  function overlay(intent: Parameters<typeof overlayLifecycleTransition>[1]): readonly MdyUiCommand[] {
    const transition = overlayLifecycleTransition({ open: open() }, intent);
    if (transition.effect === "none") return [];
    open.set(transition.state.open);
    if (transition.effect === "teardown") {
      // A closed popup keeps no query: reopening must show the whole list, not the last filter.
      query.set("");
      const commands: MdyUiCommand[] = [{ type: "close-overlay" }];
      if (transition.restoreFocus) commands.push({ type: "restore-focus", target: { part: "trigger" } });
      return commands;
    }
    return [
      { type: "open-overlay", anchor: { part: "trigger" } },
      { type: "focus", target: { part: "search" } },
    ];
  }

  function dispatch(intent: MdyMultiselectFieldIntent): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }
    if (intent.type === "search") {
      query.set(intent.query);
      return [];
    }
    if (intent.type === "focus") {
      return [];
    }
    const disabled = blocksValueChange(state().interactivity);
    if (intent.type === "open") return overlay({ type: "open", disabled, available: true });
    if (intent.type === "toggleOpen") return overlay({ type: "toggle", disabled, available: true });
    if (intent.type === "close") return overlay({ type: "close", restoreFocus: intent.restoreFocus });

    if (blocksValueChange(state().interactivity)) {
      return [];
    }

    switch (intent.type) {
      case "toggle":
        return toggle(intent.optionKey);
      case "increment":
        return increment(intent.optionKey);
      case "decrement":
        return decrement(intent.optionKey);
      case "clear":
        return clear();
    }
  }

  function setValue(values: ReadonlyArray<TValue>): void {
    handle.set(values);
  }

  function setOptions(next: readonly MdySelectOption<TValue>[]): void {
    optionList.set(next);
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
    filteredOptions,
    setValue,
    setReadonly,
    setOptions,
    destroy,
  };
}
