/**
 * Keeping the keyboard somewhere when the control it was standing on leaves play.
 *
 * Disabling a focused element blurs it — that is the platform. What follows is this library's: the
 * person who was typing is on `<body>`, their next Tab starts at the top of the document, and
 * nothing says where they went. A document's rule can do this without anyone clicking: a condition
 * turns false and the field under the cursor goes out of play mid-word.
 *
 * The deciding is `keepKeyboardInPlay`'s, not this file's — the next thing that can take focus, the
 * previous one otherwise, the widget's own root as the last resort. This only says *when*: after the
 * render that took the control out of play, which is `afterBlur`, because by then the platform has
 * already emptied the keyboard's position and there is nothing left on the control to read.
 *
 * It was unreachable while these components never re-rendered: a node that is never replaced never
 * takes anyone's place with it. Repairing the render is what made this reachable, which is the
 * ordinary shape of a structural fix rather than a regression.
 */
import { onScopeDispose, type Ref } from "vue";
import { keepKeyboardInPlay } from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";

/**
 * Watches a field's disabled state and, when it turns on, puts the keyboard somewhere.
 *
 * `root` is the widget's own element: the door reads what is inside it to decide whether the person
 * was standing there, and walks the document from its parent to find where they should go next.
 */
export function useKeyboardInPlay(field: MdyFieldHandle<unknown>, root: Ref<HTMLElement | null>): void {
  // Observed through the runtime that owns the handle, not with Vue's `watch`. Whether a field is
  // in play is the handle's signal, and a Vue watcher has nothing of Vue's to track inside one: it
  // reads correctly once and then never fires. That is the same defect these components were just
  // repaired of, and writing this with a `watch` reintroduced it in the file that repairs it.
  const reactivity = observerFor(field);
  let was: boolean | null = null;
  const watching = reactivity.effect(() => {
    const disabled = field.disabled();
    const crossed = was === false && disabled;
    was = disabled;
    // Only the crossing into disabled: a widget built disabled never held the keyboard, and moving
    // focus onto its neighbour would take a person somewhere they never asked to go.
    if (!crossed) return;
    // Whether the person was standing here, sampled now — while the control is still enabled and
    // still holding the keyboard. After the render it is gone, and `afterBlur` exists precisely
    // because focus resting on nothing is then indistinguishable from a widget nobody had reached.
    // Told to assume the blur was ours, the door takes a keyboard that was never here: a field
    // disabled on a page the person had not touched pulled focus into itself.
    const element = root.value;
    const heldTheKeyboard = element !== null
      && element.ownerDocument.activeElement !== null
      && element.contains(element.ownerDocument.activeElement);
    // After the render that took the control out of play. Read in the same turn, the element is
    // still enabled and still focused, and the door correctly decides nobody is leaving.
    queueMicrotask(() => {
      const still = root.value;
      if (still === null) return;
      keepKeyboardInPlay(still, still.parentElement, { afterBlur: heldTheKeyboard });
    });
  });
  onScopeDispose(() => { watching.destroy(); });
}
