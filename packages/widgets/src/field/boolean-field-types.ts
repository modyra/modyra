/**
 * Boolean field widget types (checkbox / toggle).
 */

import type { MdyInteractivity } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";

export type MdyBooleanFieldVariant = "checkbox" | "switch";

export interface MdyBooleanFieldControllerOptions {
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
