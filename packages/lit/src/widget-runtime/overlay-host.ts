/**
 * Overlay lifecycle for the Lit elements that own a popup.
 *
 * Every decision — whether a toggle opens, whether Escape or a pointer outside closes, whether
 * focus is restored — is `overlayLifecycleTransition` in `@modyra/widgets`. These helpers only
 * carry the element's `_open` flag in and out of it, so no element re-decides the policy locally.
 */
import { createLightDismiss, MDY_WIDGET_CONTRACTS, overlayLifecycleTransition, type MdyOverlayLifecycleIntent, bindLightDismiss } from "@modyra/widgets";

/** A teardown for the case where nothing was bound. */
const noop = (): void => undefined;

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
 * Whether the contract asks for outside-gesture dismissal at all.
 *
 * Not a per-renderer choice, and neither is the gesture: `createOutsidePointerGesture` holds the
 * rule and this package consumes it. Every overlay kind declares the same one, so asking any of them
 * is asking the contract.
 */
export function outsideDismissDeclared(): boolean {
  return MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnOutsidePointer !== false;
}

/**
 * Dismisses the host's overlay when a gesture completes outside it — the default every widget with
 * `capabilities.dismissOnOutsidePointer` declares. Returns the teardown.
 */
export function bindOutsidePointer(
  host: OverlayHost,
  onClose: () => void,
): () => void {
  // Nothing declared: no listeners, and a teardown that has nothing to undo.
  if (!outsideDismissDeclared()) return noop;

  const policy = createLightDismiss({
    isOpen: () => host._open,
    // Duck-typed: `Node` is not a global in every host this package runs in.
    isInside: (target: unknown) => {
      const node = target as Node | null;
      return node !== null && typeof node === "object"
        && typeof (node as { nodeType?: unknown }).nodeType === "number"
        && host.contains(node);
    },
    dismiss: () => {
      const transition = applyOverlayIntent(host, { type: "outside", outside: true });
      if (transition.effect === "teardown") onClose();
    },
  });

  return bindLightDismiss(policy);
}
