/**
 * Select widget types.
 */

import type { MdySelectOption } from "@modyra/core";

export interface MdySelectControllerOptions<TValue> {
  /** Stable identity for the widget instance; used for deterministic IDs. */
  readonly widgetId: string;
  /** Full list of options. */
  readonly options: readonly MdySelectOption<TValue>[];
  /** Maps an option to a stable string key. Defaults to `String(option.value)`. */
  readonly keyFor?: (option: MdySelectOption<TValue>) => string;
  /** Initial selected value; null means nothing selected. */
  readonly value?: TValue | null;
  /** Whether the widget is disabled. */
  readonly disabled?: boolean;
  /** Whether the widget is readonly. */
  readonly readonly?: boolean;
  /** Whether the widget is invalid. */
  readonly invalid?: boolean;
  /** Whether options are loading. */
  readonly loading?: boolean;
  /** Called when the value changes. */
  readonly onChange?: (value: TValue | null) => void;
}

/** Semantic state of the select widget. */
export interface MdySelectState<TValue> {
  readonly open: boolean;
  readonly query: string;
  readonly activeKey: string | null;
  readonly selectedValue: TValue | null;
  readonly selectedKey: string | null;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly invalid: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly loading: boolean;
}

/** User/host intent for the select widget. */
export type MdySelectIntent =
  | { readonly type: "open"; readonly source: "keyboard" | "pointer" }
  | { readonly type: "close"; readonly restoreFocus: boolean }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" }
  | { readonly type: "select"; readonly optionKey: string }
  | { readonly type: "search"; readonly query: string }
  | { readonly type: "blur" }
  | { readonly type: "focus" };
