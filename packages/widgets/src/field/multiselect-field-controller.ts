/**
 * Headless multiselect field controller. Modeled on Angular's real, working
 * `MdyMultiselectComponent` (packages/angular/src/lib/renderers/multiselect)
 * — same `"single"`/`"multi"` selection semantics and the same shared
 * `filterOptionsByQuery` search logic that renderer already reuses from
 * select — ported into the `MdyFieldHandle`-driven shape every controller
 * in this package follows (see option-field-controller.ts), since Angular's
 * own component wires its field state through its own two-hop adapter
 * indirection rather than a portable handle.
 */
import type { MdyReactivity, MdySelectOption, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import { filterOptionsByQuery } from "@modyra/core/options-utils";

import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectMultiselectFieldA11y } from "./multiselect-field-a11y.js";
import type {
  MdyMultiselectFieldControllerOptions,
  MdyMultiselectFieldIntent,
  MdyMultiselectFieldState,
} from "./multiselect-field-types.js";

export interface MdyMultiselectFieldController<TValue>
  extends MdyWidgetController<MdyMultiselectFieldState<TValue>, MdyMultiselectFieldIntent> {
  /** Options remaining after `state().query` filters them (same `filterOptionsByQuery` search Angular's own multiselect/select renderers already share) — the host renders this list, not the full `options` array, once a search intent has narrowed it. */
  readonly filteredOptions: MdySignal<readonly MdySelectOption<TValue>[]>;
  /** Set the selected values programmatically without producing a command. */
  setValue(values: ReadonlyArray<TValue>): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
}

export function createMultiselectFieldController<TValue>(
  options: MdyMultiselectFieldControllerOptions<TValue>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyMultiselectFieldController<TValue> {
  const {
    widgetId,
    handle,
    options: allOptions,
    keyFor = (option) => String(option.value),
    mode = "single",
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

  const keysOf = (values: ReadonlyArray<TValue>): string[] =>
    values
      .map((value) => [...optionByKey.entries()].find(([, o]) => o.value === value)?.[0])
      .filter((key): key is string => key !== undefined);

  const readonly = reactivity.signal(initialReadonly);
  const query = reactivity.signal("");

  const state: MdySignal<MdyMultiselectFieldState<TValue>> = reactivity.computed(() => {
    const selectedValues = handle.value();
    const keys = keysOf(selectedValues);
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    return {
      selectedValues,
      selectedKeys: new Set(keys),
      counts,
      query: query(),
      invalid: !handle.valid(),
      disabled: handle.disabled(),
      readonly: readonly(),
      required: handle.required(),
      touched: handle.touched(),
      dirty: handle.dirty(),
      pending: handle.pending(),
    };
  });

  const filteredOptions: MdySignal<readonly MdySelectOption<TValue>[]> = reactivity.computed(() =>
    filterOptionsByQuery(allOptions, query()),
  );

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectMultiselectFieldA11y(currentState, handle.errors(), { widgetId });

    const parts: Record<string, ReturnType<typeof a11yOption>> = {};
    for (const option of allOptions) {
      const key = keyFor(option);
      parts[key] = a11yOption(key, option, currentState);
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

  function a11yOption(key: string, option: MdySelectOption<TValue>, currentState: MdyMultiselectFieldState<TValue>) {
    const selected = currentState.selectedKeys.has(key);
    const count = currentState.counts.get(key) ?? 0;
    const disabled = option.disabled || currentState.disabled || currentState.readonly;
    return {
      id: `${widgetId}__opt__${key}`,
      classes: [
        "mdy-multiselect__chip",
        ...(selected ? ["mdy-multiselect__chip--selected"] : []),
        ...(disabled ? ["mdy-multiselect__chip--disabled"] : []),
      ],
      attributes: {
        ...(mode === "single" ? { "aria-pressed": selected } : { "data-count": count }),
        "aria-disabled": disabled,
        disabled: option.disabled || currentState.disabled,
      },
    };
  }

  function withOption(key: string, run: (option: MdySelectOption<TValue>) => readonly MdyUiCommand[]): readonly MdyUiCommand[] {
    const option = optionByKey.get(key);
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
    const option = optionByKey.get(key);
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

    if (state().disabled || state().readonly) {
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
    destroy,
  };
}
