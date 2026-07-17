/**
 * Primitive field widget types.
 *
 * These widgets are thin controllers over the form engine's field handle.
 * They do not duplicate value/validation state; they project it into a
 * universal accessibility and styling contract.
 */

import type { MdyFieldHandle } from "@modyra/core";

export interface MdyFieldControllerOptions<TValue> {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle that owns value/validation lifecycle. */
  readonly handle: MdyFieldHandle<TValue>;
  /** Native input type (e.g. "text", "email", "number", "password"). */
  readonly inputType?: string;
  /** Native inputmode hint. */
  readonly inputMode?: string;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
  /** Whether the widget should use autocomplete. */
  readonly autocomplete?: string;
}

/** Semantic state of a primitive field widget. */
export interface MdyFieldState<TValue> {
  readonly value: TValue;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

/** User/host intent for a primitive field widget. */
export type MdyFieldIntent<TValue> =
  | { readonly type: "focus" }
  | { readonly type: "blur" }
  | { readonly type: "input"; readonly value: TValue };
