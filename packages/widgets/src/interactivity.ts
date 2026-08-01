/**
 * What a field's interactivity permits.
 *
 * `disabled` and `readonly` used to be two independent booleans, and **fourteen** call sites across
 * the controllers each wrote their own combination of them. They did not agree. Most wrote
 * `disabled || readonly`, which is right for changing a value and wrong for everything else;
 * `multiselect-field-a11y.ts` used it to apply a **native `disabled`**, which takes focusability
 * away from a read-only control — the one thing read-only exists to preserve.
 *
 * These are the two questions those sites were actually asking. Name them, so the fifteenth site
 * cannot invent a fifteenth answer.
 *
 * The states differ in exactly one place, and it is the place that matters:
 *
 * | interactivity | may change the value | may focus, select, copy |
 * | --- | --- | --- |
 * | `enabled`    | yes | yes |
 * | `readonly`   | no  | **yes** |
 * | `disabled`   | no  | no |
 */
import type { MdyInteractivity } from "@modyra/core";

/**
 * Whether the user may not change the value.
 *
 * True for both `readonly` and `disabled` — this is the half the two states genuinely share, and
 * the reason `disabled || readonly` looked correct everywhere it was written.
 *
 * Use it for input, selection, toggling, stepping, clearing, and confirming a picker: anything that
 * would write.
 */
export function blocksValueChange(interactivity: MdyInteractivity): boolean {
  return interactivity !== "enabled";
}

/**
 * Whether the user may not reach the control at all.
 *
 * True only for `disabled`. A read-only control keeps its place in the tab order, takes focus, and
 * lets its text be selected and copied — a value you may read but not rewrite is useless if you
 * cannot get to it.
 *
 * Use it for the native `disabled` attribute, `tabindex`, and anything that decides whether the
 * control can be reached. Opening a popup purely to *read* it belongs here too, not to
 * {@link blocksValueChange}.
 */
export function blocksFocus(interactivity: MdyInteractivity): boolean {
  return interactivity === "disabled";
}
