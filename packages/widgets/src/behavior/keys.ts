/**
 * What a key means to a widget, and what a listbox does with an arrow.
 *
 * The mapping from a key to an intent belongs to the kind — a combobox opens on ArrowDown, a dialog
 * overlay does not — and the catalogue is what says which is which.
 */
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetKind } from "../catalog.js";
import { keyBindingFor } from "../transitions.js";
export type MdyWidgetKeyIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus: boolean }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" }
  | { readonly type: "commit" }
  | { readonly type: "cancel"; readonly restoreFocus: boolean }
  | { readonly type: "toggle" }
  | { readonly type: "increment" }
  | { readonly type: "decrement" };

/**
 * How close to the viewport edge a popup may sit. Exported because it is part of the placement
 * arithmetic an adapter or a test has to be able to reproduce: room above an anchor is
 * `anchorTop - MDY_OVERLAY_VIEWPORT_MARGIN`, not `anchorTop`.
 */

export function widgetKeyIntent(kind: MdyWidgetKind, key: string, open: boolean): MdyWidgetKeyIntent | null {
  // Reads the kind's declared bindings rather than answering the same way for all seventeen. It used
  // to special-case `number` and the four togglable kinds and give everything else list navigation,
  // so a text field claimed ArrowDown, a textarea claimed Enter, and a slider — whose arrows must
  // change its value — was told to move through options it does not have.
  const binding = keyBindingFor(kind, key, open);
  if (!binding) return null;
  switch (binding.intent) {
    case "cancel": return { type: "cancel", restoreFocus: binding.restoresFocus ?? true };
    case "open": return { type: "open" };
    case "commit": return { type: "commit" };
    case "toggle": return { type: "toggle" };
    case "step":
      return key === "ArrowUp" ? { type: "increment" } : { type: "decrement" };
    case "move":
      return {
        type: "move",
        target: key === "ArrowDown" ? "next" : key === "ArrowUp" ? "previous" : key === "Home" ? "first" : "last",
      };
  }
}

export function overlayCloseCommands(restoreFocus: boolean): readonly MdyUiCommand[] {
  return restoreFocus
    ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
    : [{ type: "close-overlay" }];
}

export type MdyOptionNavigationTarget = "next" | "previous" | "first" | "last";

/** Resolves roving option navigation without any framework or DOM dependency. */
/**
 * Listbox navigation: clamps at the ends, and ArrowUp from "nothing active" lands on the last
 * option. Distinct from `optionNavigationIndex`, which wraps because a segmented control is a
 * closed ring. Adapters take both from here so a listbox never quietly behaves like a ring.
 */
export { listboxNextIndex as listboxNavigationIndex } from "@modyra/core/ui";

export function optionNavigationIndex(
  key: string,
  currentIndex: number,
  optionCount: number,
): number | null {
  if (optionCount <= 0) return null;
  const current = Math.max(0, Math.min(currentIndex, optionCount - 1));
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % optionCount;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + optionCount) % optionCount;
    case "Home":
      return 0;
    case "End":
      return optionCount - 1;
    default:
      return null;
  }
}
