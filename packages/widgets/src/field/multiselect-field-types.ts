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
  /**
   * Which option the keyboard is on inside the open popup, or `null` when it is on none.
   *
   * A cursor, not a selection: moving it changes nothing about the value, and `select` is what
   * commits whatever it is on. Without it the popup's own keyboard policy — which has always
   * returned `move` and `select` — had nothing to move and nothing to commit, so a person who
   * opened the list with a keyboard could not choose from it.
   */
  readonly activeKey: string | null;
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
  /**
   * Moves the cursor through the options a person can currently see.
   *
   * Through the *filtered* list, because a cursor that walked the declared one would stop on rows
   * the search has hidden. It changes nothing about the value: `select` is what commits.
   */
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" }
  /**
   * Takes whatever the cursor is on, or the option named. Nothing when it is on nothing.
   *
   * `optionKey` is optional because the popup's own keyboard policy already resolves the cursor and
   * hands back what it landed on; a caller that has not is welcome to leave it out.
   */
  | { readonly type: "select"; readonly optionKey?: string }
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "toggleOpen" }
  | { readonly type: "clear" }
  /**
   * Moves a chosen value to another position in the value.
   *
   * The **only** thing that moves one. Until this existed, reordering meant removing and re-adding,
   * which can put a value last and nowhere else — and only from the option list, rather than from
   * the chip in front of the person. A keyboard reaches it through `MDY_WIDGET_KEYBOARD`; a drag is
   * a second door onto the same intent rather than a mechanism of its own, so the two cannot come
   * to disagree about what an order is.
   *
   * `to` is an index into the distinct chosen values, clamped rather than refused: a control asking
   * for one past either end means "as far as it goes", which is what holding an arrow down does.
   *
   * A value taken more than once moves as one thing — the quantity travels with it, because the
   * chip a person is moving is the quantity.
   */
  | { readonly type: "move-selected"; readonly optionKey: string; readonly to: number }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
