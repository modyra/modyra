/**
 * Colour field widget types.
 *
 * The value is a HEX string, and there are three ways to give one: the platform's own picker, typing
 * it, and choosing a preset. They are one value with three doors, and the doors differ in one respect
 * only — a preset is a decision, so it closes the overlay, while typing `#0` is a value on its way to
 * being one and must not.
 */
import type { MdyFieldHandle, MdyInteractivity } from "@modyra/core";

export interface MdyColorsFieldControllerOptions {
  readonly widgetId: string;
  readonly handle: MdyFieldHandle<string>;
  /** The swatches offered under the input. Empty is legitimate: not every colour field suggests. */
  readonly presets?: readonly string[];
  readonly readonly?: boolean;
}

/** One offered swatch, with whether it is the value now. */
export interface MdyColorsFieldPreset {
  readonly value: string;
  readonly selected: boolean;
}

export interface MdyColorsFieldState {
  /** What the form holds. */
  readonly value: string;
  /**
   * What is in the text box, which is not the same thing.
   *
   * `#0` is three keystrokes away from a colour and must survive being typed. Committing on every
   * keystroke would either reject it — clearing what the person is halfway through writing — or
   * accept it as black.
   */
  readonly text: string;
  readonly presets: ReadonlyArray<MdyColorsFieldPreset>;
  readonly open: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly interactivity: MdyInteractivity;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly pending: boolean;
}

export type MdyColorsFieldIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  /** The platform's own colour input, which only ever produces a valid value. */
  | { readonly type: "native"; readonly value: string }
  /** A keystroke in the text box: kept as typed, committed only when it is a colour. */
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "preset"; readonly value: string }
  | { readonly type: "focus" }
  | { readonly type: "blur" };
