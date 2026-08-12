/**
 * What every field's state has in common.
 *
 * This is the base, and it is the only thing in this file that is one. The options and the intent
 * that used to sit beside it carry `inputType`, `inputMode` and `autocomplete` — they describe a
 * text-like control and nothing else, and having them here is what made the "generic" trio read as
 * the shared abstraction while being one family's implementation.
 *
 * Every kind's own state is this plus what that kind adds: a datepicker's view month, a range's
 * draft, a file field's refusals.
 */
import type { MdyInteractivity } from "@modyra/core";
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

