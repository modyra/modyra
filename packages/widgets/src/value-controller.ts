import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";
import type { MdyUiCommand } from "./commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "./contract.js";

export type MdyValueWidgetIntent<T> =
  | { readonly type: "input"; readonly value: T }
  | { readonly type: "select"; readonly value: T }
  | { readonly type: "toggle" }
  | { readonly type: "increment"; readonly step?: number; readonly max?: number | null }
  | { readonly type: "decrement"; readonly step?: number; readonly min?: number | null }
  | { readonly type: "blur" }
  | { readonly type: "focus" };

export interface MdyValueWidgetState<T> {
  readonly value: T;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly invalid: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
}

export interface MdyValueWidgetController<T>
  extends MdyWidgetController<MdyValueWidgetState<T>, MdyValueWidgetIntent<T>> {
  setValue(value: T): void;
  setDisabled(disabled: boolean): void;
  setReadonly(readonly: boolean): void;
  setInvalid(invalid: boolean): void;
}

export interface MdyValueWidgetControllerOptions<T> {
  readonly kind: MdyWidgetKind;
  readonly value: T;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly invalid?: boolean;
  readonly onChange?: (value: T) => void;
}

/** Controller shared by scalar fields whose semantic transition is value + dirty/touched. */
export function createValueWidgetController<T>(
  options: MdyValueWidgetControllerOptions<T>,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyValueWidgetController<T> {
  const definition = MDY_WIDGET_CONTRACTS[options.kind];
  const value = reactivity.signal(options.value);
  const disabled = reactivity.signal(options.disabled ?? false);
  const readonly = reactivity.signal(options.readonly ?? false);
  const invalid = reactivity.signal(options.invalid ?? false);
  const touched = reactivity.signal(false);
  const dirty = reactivity.signal(false);

  const state: MdySignal<MdyValueWidgetState<T>> = reactivity.computed(() => ({
    value: value(), disabled: disabled(), readonly: readonly(), invalid: invalid(),
    touched: touched(), dirty: dirty(),
  }));
  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => ({
    root: definition.parts.root,
    parts: definition.parts,
    structure: definition.structure,
  }));

  function commit(next: T): readonly MdyUiCommand[] {
    value.set(next);
    dirty.set(true);
    options.onChange?.(next);
    return [{ type: "emit-change" }, { type: "mark-dirty" }];
  }

  function dispatch(intent: MdyValueWidgetIntent<T>): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      touched.set(true);
      return [{ type: "mark-touched" }];
    }
    if (intent.type === "focus") return [];
    if (disabled() || readonly()) return [];
    if (intent.type === "input" || intent.type === "select") return commit(intent.value);
    if (intent.type === "toggle") return commit((!value()) as T);
    const current = Number(value());
    if (!Number.isFinite(current)) return [];
    const step = intent.step ?? 1;
    const next = intent.type === "increment"
      ? Math.min(intent.max ?? Number.POSITIVE_INFINITY, current + step)
      : Math.max(intent.min ?? Number.NEGATIVE_INFINITY, current - step);
    return commit(next as T);
  }

  return {
    state, view, dispatch,
    setValue: value.set,
    setDisabled: disabled.set,
    setReadonly: readonly.set,
    setInvalid: invalid.set,
    destroy() {
      // no-op
    },
  };
}
