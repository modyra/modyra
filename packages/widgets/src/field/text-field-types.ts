/**
 * The text family: text, email, password, textarea, number and slider.
 *
 * One controller serves all six because they are one control with different native types — which is
 * true, and was hidden by calling the file `field-*`. A reader looking for the text field did not
 * find it, and a reader looking for the base every kind shares found a text field.
 *
 * The base is `field-types.ts` for the state and `shell-a11y.ts` for the anatomy every kind wears.
 */
import type { MdyFieldConstraints, MdyFieldHandle } from "@modyra/core";

export interface MdyTextFieldControllerOptions<TValue> {
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
/** User/host intent for a primitive field widget. */
export type MdyTextFieldIntent<TValue> =
  | { readonly type: "focus" }
  | { readonly type: "blur" }
  | { readonly type: "input"; readonly value: TValue };
