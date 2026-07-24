/**
 * Multiselect field widget types. Modeled on Angular's real, working
 * `MdyMultiselectComponent` (packages/angular/src/lib/renderers/multiselect):
 * value is a plain array, not a Set, and the widget supports the same two
 * selection semantics Angular's does — `"single"` (a toggle-set: each
 * option is either in the array or not) and `"multi"` (a counter/bag:
 * incrementing an already-selected option appends another array entry).
 */
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";

export type MdyMultiselectFieldMode = "single" | "multi";

export interface MdyMultiselectFieldControllerOptions<TValue> {
  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle that owns value/validation lifecycle. */
  readonly handle: MdyFieldHandle<ReadonlyArray<TValue>>;
  /** Full list of options. */
  readonly options: readonly MdySelectOption<TValue>[];
  /** Maps an option to a stable string key. Defaults to `String(option.value)`. */
  readonly keyFor?: (option: MdySelectOption<TValue>) => string;
  /** Toggle-set (default) or counter/bag selection semantics. */
  readonly mode?: MdyMultiselectFieldMode;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
}

/** Semantic state of a multiselect field widget. */
export interface MdyMultiselectFieldState<TValue> {
  readonly selectedValues: ReadonlyArray<TValue>;
  readonly selectedKeys: ReadonlySet<string>;
  /** Occurrence count per option key — always populated, mainly meaningful in `"multi"` mode. */
  readonly counts: ReadonlyMap<string, number>;
  readonly query: string;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

/** User/host intent for a multiselect field widget. */
export type MdyMultiselectFieldIntent =
  | { readonly type: "toggle"; readonly optionKey: string }
  | { readonly type: "increment"; readonly optionKey: string }
  | { readonly type: "decrement"; readonly optionKey: string }
  | { readonly type: "search"; readonly query: string }
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
