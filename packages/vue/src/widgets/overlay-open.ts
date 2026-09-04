/**
 * Showing and hiding a panel through the door that decides what a panel *is* when it is shown.
 *
 * This package wrote `hidden` on the element itself, which looks like the same thing and is not.
 * `setOverlayOpen` also puts the panel in the top layer — `popover="manual"` — and that attribute is
 * what the foundation's `.mdy-popup[popover] { position: fixed }` reads.
 *
 * **Fixed is what the coordinates mean.** `anchorOverlay` measures against the viewport, so its
 * answer is only true for a box positioned against the viewport. A panel that never became a popover
 * is laid out against the document instead, and the same numbers then point somewhere else by
 * exactly however far the page has scrolled: on a short page, nowhere; on a real one, thousands of
 * pixels above the window. Which is why a bench that mounts one field at the top of an empty page
 * could not see it, and the first page built like a consumer's could.
 *
 * It is also what takes the panel out of an `overflow: hidden` ancestor and out of any element that
 * has become a containing block for fixed descendants — the two things ADR 0130 asks a panel to
 * escape.
 */
import { onMounted, onScopeDispose, watch, type Ref } from "vue";
import { setOverlayOpen } from "@modyra/widgets";

export function useOverlayOpen(panel: Ref<HTMLElement | null>, isOpen: () => boolean): void {
  const reflect = (open: boolean): void => {
    const element = panel.value;
    if (element === null) return;
    setOverlayOpen(element, open);
  };

  // Told once the element exists, and told again whenever the state moves. The first call is what
  // sets the attribute that makes it a popover, and an immediate watcher runs before the ref it
  // needs has been filled — measured: the panel was still a plain element at rest and only became a
  // popover on the first opening.
  onMounted(() => reflect(isOpen()));
  watch(isOpen, (open) => reflect(open), { flush: "post" });
  onScopeDispose(() => reflect(false));
}
