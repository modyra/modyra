/**
 * Closing an overlay when focus settles outside the widget, where the kind declares that it should.
 *
 * `dismissOnFocusOutside` is declared by every kind that has a popup, and was honoured by one
 * renderer out of four: written out at each renderer, it was written out once. A panel left open
 * behind a field somebody has tabbed away from covers the next question and answers to a keyboard
 * that has gone elsewhere.
 *
 * **`focusin` on the document, not `focusout` on the parts.** The question is where focus *landed*,
 * and only the arrival answers it. A departure does not: a panel that repaints — a calendar swapping
 * its day grid for its months — destroys the element holding focus, which fires a departure with
 * nowhere named, indistinguishable from somebody leaving the field. Bound that way, opening the
 * month view closed the calendar it belonged to.
 *
 * It is also one listener for a widget whose parts are in two places, since a portalled panel is
 * outside the wrapper and a listener on the wrapper never sees focus reach it.
 *
 * **A pointer outranks it.** A drag begun inside the branch takes focus out on the way past, and
 * closing there would reinstate through the focus path exactly the dismissal the pointer policy
 * refuses. The field is still marked as visited: the person has been here either way.
 *
 * **The branch is read per interaction, not captured.** A renderer whose elements are refs has none
 * of them at the moment this is bound, and a list resolved once would hold the nulls it saw then.
 */
import { capabilityOf } from "./ask.js";
import type { MdyWidgetKind } from "./catalog.js";

/** What a pointer policy answers when it is the one that should decide. */
export interface MdyFocusDismissalOptions {
  readonly pointer?: { interactionFromInside(): boolean };
  readonly markVisited?: () => void;
  /** Supplied by a host that lives in another document. */
  readonly document?: Document;
}

const noop = (): void => undefined;

/**
 * Structural, never `instanceof`. This module is loaded by suites that run outside a browser, where
 * `Element` is not a global at all — a check written that way throws on the mere shape of the
 * argument, in a function that was supposed to bind one listener.
 */
const isElement = (part: unknown): part is Element =>
  typeof part === "object" && part !== null
  && typeof (part as { nodeType?: unknown }).nodeType === "number"
  && typeof (part as { contains?: unknown }).contains === "function";

export function bindDismissOnFocusOutside(
  kind: MdyWidgetKind,
  branch: () => ReadonlyArray<Element | null | undefined>,
  isOpen: () => boolean,
  close: () => void,
  options: MdyFocusDismissalOptions = {},
): () => void {
  // Asked of the kind rather than of any kind: they all declare it today, and a kind that stops
  // declaring it must stop being closed this way without anybody editing a renderer.
  if (!capabilityOf(kind, "dismissOnFocusOutside")) return noop;
  const document_ = options.document ?? (typeof document === "undefined" ? undefined : document);
  if (document_ === undefined) return noop;

  /**
   * The widget's panel, wherever the document put it, found the way the contract says to find it:
   * the opener names it. A renderer that portals its panel out of the field does not thereby stop
   * owning it, and a list of elements written at the call site cannot know where it went.
   */
  const controlledPanel = (parts: readonly Element[]): Element | null => {
    for (const part of parts) {
      const opener = part.matches("[aria-controls]") ? part : part.querySelector("[aria-controls]");
      const id = opener?.getAttribute("aria-controls");
      if (id) {
        const panel = document_.getElementById(id);
        if (panel) return panel;
      }
    }
    return null;
  };

  const onFocusIn = (event: Event): void => {
    // Nothing to dismiss, so nothing to say. The listener is on the document — it hears every focus
    // move on the page — and without this every field with a panel dispatches a close on every one
    // of them. Six fields answering a movement in a seventh is not a no-op: a close carries a focus
    // policy, and six of them landing on one gesture fight over where focus ends up.
    if (!isOpen()) return;
    const landed = (event.target as Node | null) ?? null;
    if (landed === null) return;
    const parts = branch().filter(isElement);
    if (parts.some((part) => part.contains(landed))) return;
    if (controlledPanel(parts)?.contains(landed) === true) return;
    if (options.pointer?.interactionFromInside() === true) {
      options.markVisited?.();
      return;
    }
    close();
  };

  document_.addEventListener("focusin", onFocusIn);
  return () => document_.removeEventListener("focusin", onFocusIn);
}
