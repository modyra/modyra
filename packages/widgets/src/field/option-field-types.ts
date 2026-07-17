/**
 * Option-based field widget types (radio group / segmented).
 */

import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";

export type MdyOptionFieldVariant = "radio" | "segmented";

export interface MdyOptionFieldControllerOptions<TValue> {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle that owns value/validation lifecycle. */
  readonly handle: MdyFieldHandle<TValue | null>;
  /** Full list of options. */
  readonly options: readonly MdySelectOption<TValue>[];
  /** Maps an option to a stable string key. Defaults to `String(option.value)`. */
  readonly keyFor?: (option: MdySelectOption<TValue>) => string;
  /** Visual variant: native radio group or segmented buttons. */
  readonly variant?: MdyOptionFieldVariant;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
}

/** Semantic state of an option-based field widget. */
export interface MdyOptionFieldState<TValue> {
  readonly selectedValue: TValue | null;
  readonly selectedKey: string | null;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

/** User/host intent for an option-based field widget. */
export type MdyOptionFieldIntent =
  | { readonly type: "select"; readonly optionKey: string }
  | { readonly type: "focus" }
  | { readonly type: "blur" }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" };
