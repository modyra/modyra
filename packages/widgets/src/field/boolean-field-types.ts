/**
 * Boolean field widget types (checkbox / toggle).
 */

import type { MdyInteractivity } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";

export type MdyBooleanFieldVariant = "checkbox" | "switch";

export interface MdyBooleanFieldControllerOptions {
  /**
   * The words under this control, asked on every projection, or `null` where there are none.
   *
   * The projection names the description in `aria-describedby` only when it has been given
   * something to put there, so a control cannot send a reader to an empty element. `true` says
   * there are words this cannot carry — a template or a slot the renderer draws itself.
   */
  readonly supportingText?: () => string | true | null;

  /** Stable identity for the widget instance. */
  readonly widgetId: string;
  /** Form engine handle that owns value/validation lifecycle. */
  readonly handle: MdyFieldHandle<boolean>;
  /** Visual variant: native checkbox or switch. */
  readonly variant?: MdyBooleanFieldVariant;
  /** Whether the widget is visually/programmatically readonly. */
  readonly readonly?: boolean;
}

/** Semantic state of a boolean field widget. */
export interface MdyBooleanFieldState {
  readonly checked: boolean;
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

/** User/host intent for a boolean field widget. */
export type MdyBooleanFieldIntent =
  | { readonly type: "check" }
  | { readonly type: "uncheck" }
  | { readonly type: "toggle" }
  | { readonly type: "blur" };
