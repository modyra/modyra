/**
 * Option-based field widget types (radio group / segmented).
 */

import type { MdyInteractivity } from "@modyra/core";
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";

export type MdyOptionFieldVariant = "radio" | "segmented";

export interface MdyOptionFieldControllerOptions<TValue> {
  /**
   * The words under this control, asked on every projection, or `null` where there are none.
   *
   * The projection names the description in `aria-describedby` only when it has been given
   * something to put there, so a control cannot send a reader to an empty element. `true` says
   * there are words this cannot carry — a template or a slot the renderer draws itself.
   */
  readonly supportingText?: () => string | true | null;

  /** What a person reads beside the control, where a document declared one. */
  readonly label?: string | null;
  /** What a host wrote for the control itself, which outranks the label. */
  readonly ariaLabel?: string | null;
  /** The field's own name — the last thing left to call a group nobody named. */
  readonly fieldName?: string | null;

  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle that owns value/validation lifecycle. */
  readonly handle: MdyFieldHandle<TValue | null>;
  /** Full list of options. */
  readonly options: readonly MdySelectOption<TValue>[];
  /** Maps an option to a stable string key. Defaults to {@link defaultOptionKey}. */
  readonly keyFor?: (option: MdySelectOption<TValue>) => string;
  /** Visual variant: native radio group or segmented buttons. */
  readonly variant?: MdyOptionFieldVariant;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
  /**
   * Whether the error list is in the document, given the field's state.
   *
   * Unlike the field shell, this widget's accessibility projection sits behind the controller, so a
   * renderer cannot answer for itself and has to be asked here. A renderer that defers its error
   * list until the field is touched says so, and `aria-describedby` then names the supporting text
   * while the list is absent rather than an element that is not there.
   *
   * Defaults to "there are errors", which is correct for a renderer that always shows them.
   */
  readonly errorsVisible?: (state: MdyOptionFieldState<TValue>) => boolean;
}

/** Semantic state of an option-based field widget. */
export interface MdyOptionFieldState<TValue> {
  readonly selectedValue: TValue | null;
  readonly selectedKey: string | null;
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

/** User/host intent for an option-based field widget. */
export type MdyOptionFieldIntent =
  | { readonly type: "select"; readonly optionKey: string }
  | { readonly type: "focus" }
  | { readonly type: "blur" }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" };
