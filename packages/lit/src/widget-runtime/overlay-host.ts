/**
 * Overlay lifecycle for the Lit elements that own a popup.
 *
 * Every decision — whether a toggle opens, whether Escape or a pointer outside closes, whether
 * focus is restored — is `overlayLifecycleTransition` in `@modyra/widgets`. These helpers only
 * carry the element's `_open` flag in and out of it, so no element re-decides the policy locally.
 */
import { overlayLifecycleTransition, type MdyOverlayLifecycleIntent } from "@modyra/widgets";

export interface OverlayHost {
  /** Current open state; assigning it triggers the element's own update. */
  _open: boolean;
  contains(node: Node): boolean;
}

/** Applies an intent and returns the transition the policy produced. */
export function applyOverlayIntent(host: OverlayHost, intent: MdyOverlayLifecycleIntent) {
  const transition = overlayLifecycleTransition({ open: host._open }, intent);
  host._open = transition.state.open;
  return transition;
}

/**
 * Dismisses the host's overlay when a pointer goes down outside it — the default every widget with
 * `capabilities.dismissOnOutsidePointer` declares. Returns the teardown.
 */
export function bindOutsidePointer(
  host: OverlayHost,
  onClose: () => void,
): () => void {
  const onPointerDown = (event: Event): void => {
    if (!host._open) return;
    // Duck-typed: `Node` is not a global in every host this package runs in.
    const target = event.target as Node | null;
    const inside = target !== null && typeof target.nodeType === "number" && host.contains(target);
    const transition = applyOverlayIntent(host, { type: "outside", outside: !inside });
    if (transition.effect === "teardown") onClose();
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}
