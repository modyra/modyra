import { ElementRef } from "@angular/core";
import type { MdyTimeFormat } from "@modyra/core/datetime";
import {
  partSelector, timepickerPartSelector, timepickerTabOrder } from "@modyra/widgets";

/**
 * The elements a timepicker command may name, resolved through the contract's own selectors.
 *
 * Queried rather than held as view children: the popup is projected into a panel that only exists
 * while it is open, so a reference taken at construction is a reference to nothing.
 *
 * The trigger is named separately because it is the one part that lives outside the popup and
 * outside the tab order the contract publishes — it is what a `restore-focus` command returns to.
 */
export function timepickerCommandElements(
  root: HTMLElement,
  format: MdyTimeFormat,
): ReadonlyMap<string, ElementRef<HTMLElement>> {
  const found = new Map<string, ElementRef<HTMLElement>>();
  found.set("trigger", new ElementRef(root.querySelector<HTMLElement>(partSelector("timepicker", "toggle") ?? "\0") ?? root));
  for (const part of timepickerTabOrder(format)) {
    const selector = timepickerPartSelector(part);
    const el = selector ? root.querySelector<HTMLElement>(selector) : null;
    if (el) found.set(part, new ElementRef(el));
  }
  return found;
}
