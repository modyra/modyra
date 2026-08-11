/**
 * Primitive field widget types.
 *
 * These widgets are thin controllers over the form engine's field handle.
 * They do not duplicate value/validation state; they project it into a
 * universal accessibility and styling contract.
 */

import type { MdyInteractivity } from "@modyra/core";
import type { MdyFieldConstraints, MdyFieldHandle } from "@modyra/core";

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
  /**
   * The kind this control belongs to, so the projection knows which native constraints it can carry.
   * Defaults to `inputType`, which is the same answer for every text-like control.
   */
  readonly kind?: string;
  /**
   * Narrows what this control offers, on top of what the field's rules state.
   *
   * A control may ask for less than the field accepts — a slider bounded tighter than its rule, a
   * number input capped by a caller — and this is where it says so. It cannot ask for more: the
   * rules are the authority, and what is offered is their intersection with this.
   *
   * Read rather than captured, because a control's own limits are inputs that change: an element
   * whose `max` is set after it connects would otherwise keep offering the one it was born with.
   */
  readonly constraints?: () => Partial<MdyFieldConstraints>;
}

/** Semantic state of a primitive field widget. */
export interface MdyFieldState<TValue> {
  readonly value: TValue;
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

/** User/host intent for a primitive field widget. */
export type MdyFieldIntent<TValue> =
  | { readonly type: "focus" }
  | { readonly type: "blur" }
  | { readonly type: "input"; readonly value: TValue };
