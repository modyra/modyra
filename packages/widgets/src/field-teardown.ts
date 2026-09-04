/**
 * A field that leaves the scene closes what it holds open.
 *
 * There were two ways an overlay closed, and a third that nobody owned. The controller closes on an
 * **intention** — a press, Escape, a pointer finishing outside. A component destroys on **end of
 * life**. A field taken out of the document by a rule the document itself carries is neither: no
 * intention arrives and nothing is destroyed, so an open panel simply stays, on a page whose field
 * is gone.
 *
 * **Three renderers pass this without deciding anything.** They draw the panel inside the field's own
 * subtree, so whatever removes the field takes the panel with it. That is a consequence of where a
 * node sits, not a guarantee — and ADR 0131 says in as many words that where a renderer puts its
 * popup *is not decided by this project*. So the contract was resting a promise on a choice it had
 * declared free, and the renderer that exercised the freedom lost the promise. This is the promise,
 * stated on its own.
 *
 * ADR 0131 is untouched: a renderer may still put its popup wherever it likes. What changes is that
 * the closing no longer depends on that.
 *
 * **And the keyboard is part of the same moment.** A field that leaves takes its control with it, so
 * a person standing there is left on `<body>` with their next Tab starting at the top of the page —
 * the same loss `keepKeyboardInPlay` answers when a control is disabled, arriving by a different
 * road. One door, because it is one instant: the field goes, its overlay closes, the keyboard lands
 * somewhere a person can carry on from.
 */
import { keepKeyboardInPlay } from "./focus.js";

export interface MdyFieldTeardown {
  /** Close what the field holds open. Called once, after the field has left the document. */
  close(): void;
  /**
   * Whether the keyboard was in the field when it left, and so is owed a place.
   *
   * Asked rather than assumed: a field removed while nobody was standing in it owes nothing, and
   * moving focus onto its neighbour would take a person somewhere they never asked to go.
   */
  readonly heldTheKeyboard?: boolean;
}

/**
 * Watches `root` and answers when it leaves the document. Returns the unbind.
 *
 * The observer is on the parent rather than on the element: a node cannot report its own removal,
 * because by then it is no longer where the report would come from.
 */
export function closeWhenFieldLeaves(
  root: Element,
  teardown: MdyFieldTeardown,
): () => void {
  const parent = root.parentElement;
  const document_ = root.ownerDocument;
  const view = document_?.defaultView as { MutationObserver?: typeof MutationObserver } | null;
  const Observer = view?.MutationObserver;
  // A host with no observer is not a host this can watch. It says so by binding nothing rather than
  // by throwing: the widget keeps working, and the guarantee is simply not held there.
  if (parent === null || Observer === undefined) return () => undefined;

  // Where the keyboard stood, read while the field is still in the document. After the removal there
  // is nothing left to ask.
  const held = teardown.heldTheKeyboard
    ?? (document_ !== null && root.contains(document_.activeElement));

  const observer = new Observer(() => {
    if (root.isConnected) return;
    observer.disconnect();
    teardown.close();
    // The keyboard's place is decided from where the field was, so the scope is the parent it was
    // removed from. `afterBlur` because the platform has already emptied the position by the time a
    // removal is reported.
    if (held) keepKeyboardInPlay(root, parent, { afterBlur: true });
  });
  observer.observe(parent, { childList: true, subtree: true });
  return () => observer.disconnect();
}
