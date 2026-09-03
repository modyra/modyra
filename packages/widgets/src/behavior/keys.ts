/**
 * What a key means to a widget, and what a listbox does with an arrow.
 *
 * The mapping from a key to an intent belongs to the kind — a combobox opens on ArrowDown, a dialog
 * overlay does not — and the catalogue is what says which is which.
 */
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetKind } from "../catalog.js";
import { keyBindingFor, type MdyKeyOrPress } from "../transitions.js";
export type MdyWidgetKeyIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus: boolean }
  | { readonly type: "move"; readonly target: "next" | "previous" | "first" | "last" }
  | { readonly type: "commit" }
  | { readonly type: "cancel"; readonly restoreFocus: boolean }
  | { readonly type: "toggle" }
  | { readonly type: "increment" }
  | { readonly type: "decrement" }
  /** Move whatever holds focus one place earlier or later in the value. */
  | { readonly type: "reorder"; readonly by: -1 | 1 }
  /** Take off whatever holds focus. */
  | { readonly type: "remove" }
  /**
   * A printable character typed at a list: jump to the first option that begins with it.
   *
   * Carries the character rather than a target, because which option it lands on depends on the
   * labels — and the labels are the renderer's, not this layer's.
   */
  | { readonly type: "typeahead"; readonly character: string }
  /**
   * Pick up whatever holds focus, or put it down — one key, because it is one state seen from both
   * ends. What is held moves with the bare arrows and goes back where it was on `Escape`.
   */
  | { readonly type: "grab" }
  /** Put back the last destructive change, whichever act produced it. */
  | { readonly type: "undo" }
  /**
   * Show the same value at a wider or narrower scope: `1` out to the months and then the years,
   * `-1` back in. Not a `move` — nothing about the value changes, only which of the kind's views is
   * the one being walked.
   */
  | { readonly type: "view"; readonly by: -1 | 1 };

/**
 * How close to the viewport edge a popup may sit. Exported because it is part of the placement
 * arithmetic an adapter or a test has to be able to reproduce: room above an anchor is
 * `anchorTop - MDY_OVERLAY_VIEWPORT_MARGIN`, not `anchorTop`.
 */

export function widgetKeyIntent(kind: MdyWidgetKind, key: MdyKeyOrPress, open: boolean): MdyWidgetKeyIntent | null {
  // The press, where the caller has one. A bare key name is still accepted and still means the bare
  // gesture — but a binding that declares a held modifier can only ever be reached by a caller that
  // passes what was held, and asking this door with a name alone silently answers for the bare
  // declaration of the same key instead.
  const name = typeof key === "string" ? key : key.key;
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
    case "undo": return { type: "undo" };
    // The gesture is declared, and what to *do* with the character is the renderer's: which option a
    // sequence of letters lands on depends on the labels, which this layer does not hold. Answering
    // null here would say the key is unclaimed and let it fall through to the platform, which is the
    // opposite of what the declaration means.
    case "typeahead": return { type: "typeahead", character: name };
    case "toggle": return { type: "toggle" };
    case "step":
      return name === "ArrowUp" ? { type: "increment" } : { type: "decrement" };
    case "move":
      // A binding that carries a direction says which way it goes; the key alone cannot, because a
      // horizontal strip runs in the writing direction and `ArrowLeft` is *later* in a right-to-left
      // document. `toEnd` is the same direction taken as far as it goes.
      if (binding.by !== undefined) {
        return {
          type: "move",
          target: binding.toEnd
            ? (binding.by === -1 ? "first" : "last")
            : (binding.by === -1 ? "previous" : "next"),
        };
      }
      return {
        type: "move",
        target: name === "ArrowDown" ? "next" : name === "ArrowUp" ? "previous" : name === "Home" ? "first" : "last",
      };
    // The direction is the binding's, not the key's: the strip runs in the writing direction, so in
    // a right-to-left document `ArrowLeft` moves a chip later rather than earlier.
    case "reorder": return { type: "reorder", by: binding.by ?? 1 };
    case "remove": return { type: "remove" };
    case "grab": return { type: "grab" };
    // A direction is what a view change *is*, so a declaration without one is not an intent this can
    // answer. Defaulting would invent a direction the contract did not state, and out and in are not
    // interchangeable.
    case "view": return binding.by === undefined ? null : { type: "view", by: binding.by };
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
