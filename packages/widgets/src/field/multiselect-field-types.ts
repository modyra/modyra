/**
 * Multiselect field widget types.
 *
 * The value is an array rather than a Set, because order is part of it and the same option may
 * appear more than once. Two selection semantics use that: `"single"` is a toggle-set — an option is
 * in the array or not — and `"multi"` is a bag, where taking an already-taken option appends another
 * entry and the chip shows how many.
 */
import type { MdyInteractivity, MdyMultiselectMode } from "@modyra/core";
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";

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
  readonly mode?: MdyMultiselectMode;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
}

/** Semantic state of a multiselect field widget. */
export interface MdyMultiselectFieldState<TValue> {
  /**
   * The options to paint: the declared list, plus every held value the list does not contain.
   *
   * A renderer paints this rather than the list it was handed, and that is what makes the rule the
   * contract's instead of each renderer's — a value the widget will not erase is a value it shows,
   * and one the user can therefore remove.
   */
  readonly options: readonly MdySelectOption<TValue>[];
  readonly selectedValues: ReadonlyArray<TValue>;
  readonly selectedKeys: ReadonlySet<string>;
  /** Occurrence count per option key — always populated, mainly meaningful in `"multi"` mode. */
  readonly counts: ReadonlyMap<string, number>;
  readonly query: string;
  /** Whether the option popup is showing. Multiselect picks from an overlay like every other
   *  popup widget: laying the options out inline would reflow the page on every open. */
  readonly open: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  /**
   * What the user may do. Ask it through `blocksValueChange`/`blocksFocus` rather than comparing
   * strings — the point of the union is that no call site invents its own combination again.
   */
  readonly interactivity: MdyInteractivity;
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
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "toggleOpen" }
  | { readonly type: "clear" }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
