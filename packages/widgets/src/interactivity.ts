/**
 * What a field's interactivity permits.
 *
 * Interactivity answers two independent questions, and they diverge on `readonly`. Asking them by
 * name keeps every controller and renderer to one interpretation:
 *
 * | interactivity | may change the value | may focus, select, copy |
 * | --- | --- | --- |
 * | `enabled`  | yes | yes |
 * | `readonly` | no  | **yes** |
 * | `disabled` | no  | no |
 */
import type { MdyInteractivity } from "@modyra/core";

/**
 * Whether the user may not change the value.
 *
 * True for `readonly` and `disabled` alike — this is the half the two states share.
 *
 * Guards input, selection, toggling, stepping, clearing and confirming a picker: anything that
 * writes.
 */
export function blocksValueChange(interactivity: MdyInteractivity): boolean {
  return interactivity !== "enabled";
}

/**
 * Whether the user may not reach the control at all.
 *
 * True for `disabled` only. A read-only control keeps its place in the tab order, takes focus, and
 * lets its text be selected and copied; a value you may read but not rewrite is useless if you
 * cannot get to it.
 *
 * Guards the native `disabled` attribute, `tabindex`, and anything deciding whether the control can
 * be reached — including opening a popup purely to read it.
 */
export function blocksFocus(interactivity: MdyInteractivity): boolean {
  return interactivity === "disabled";
}
