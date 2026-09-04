/**
 * Shutting a picker panel, for the kinds that open one over a control.
 *
 * Two kinds close a panel the same way, and the part that is easy to lose when it is written twice
 * is not the closing — it is what closing *means* for the value. Opening a panel and closing it
 * again is the panel's version of typing and deleting: the person saw what was on offer and took
 * none of it, so the field is touched and not dirty. ADR 0167.
 *
 * Where focus goes is the caller's, because it is the caller's question: `Escape` hands it back to
 * the control that opened the panel, and a key on its way somewhere else must not have it pulled
 * back — that strands a person on the field they were leaving.
 */
import type { MdyFieldHandle } from "@modyra/core";
import type { MdyUiCommand } from "../commands.js";

export interface MdyPickerPanel {
  /** Whether the panel is showing. Set to `false` here. */
  readonly open: { set(value: boolean): void };
  /** The field the panel belongs to, told that it was looked at. */
  readonly handle: Pick<MdyFieldHandle<unknown>, "markAsTouched">;
}

export function closePickerPanel(panel: MdyPickerPanel, restoreFocus: boolean): readonly MdyUiCommand[] {
  panel.open.set(false);
  panel.handle.markAsTouched();
  return restoreFocus
    ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
    : [{ type: "close-overlay" }];
}
