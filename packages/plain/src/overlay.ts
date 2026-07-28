/**
 * Positioning for the popups this renderer draws.
 *
 * Every decision — above or below, left- or right-aligned, how tall, how wide, and the exact
 * coordinates that follow — is `anchorOverlay` in `@modyra/widgets`. This file measures the anchor
 * and writes the `--mdy-overlay-*` properties it returns, and decides nothing of its own.
 */
import { anchorOverlay, overlayLifecycleTransition, type MdyOverlayDecision } from "@modyra/widgets";

export interface OverlayPlacementOptions {
  /** Smallest usable space before the popup flips or overlays. */
  readonly minSpace?: number;
  readonly minWidth?: number;
  readonly preferred?: "above" | "below";
  /** Write the decided width out; a content-sized popup leaves it alone. */
  readonly matchAnchorWidth?: boolean;
}

/**
 * The shape an open popup was given, kept so repositioning follows the anchor without re-deciding
 * the popup's side and height on every scroll frame. Cleared when it closes.
 */
const heldDecisions = new WeakMap<HTMLElement, MdyOverlayDecision>();

/** Forgets a popup's held shape, so the next opening decides afresh. */
export function releaseOverlayPlacement(popup: HTMLElement): void {
  heldDecisions.delete(popup);
}

/** Positions `popup` against `anchor` by applying the contract's anchoring, and returns its decision. */
export function positionOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  options: OverlayPlacementOptions = {},
): MdyOverlayDecision {
  const rect = anchor.getBoundingClientRect();
  // Every coordinate, the placement and the height come from `anchorOverlay`; this renderer only
  // measures and writes. Passing the decision it is already holding keeps an open popup's shape
  // steady while the anchor moves.
  const anchoring = anchorOverlay(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    { ...options, current: heldDecisions.get(popup) ?? null },
  );
  heldDecisions.set(popup, anchoring.decision);
  for (const [property, value] of Object.entries(anchoring.properties)) {
    popup.style.setProperty(property, value);
  }
  popup.dataset.placement = anchoring.placement;
  return anchoring.decision;
}

/**
 * Keeps a popup positioned while it is open. Returns the teardown; scroll is captured so a popup
 * inside a scrollable pane follows its anchor rather than floating away from it.
 */
export function trackOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  isOpen: () => boolean,
  options: OverlayPlacementOptions = {},
): () => void {
  const reposition = (): void => {
    if (isOpen()) positionOverlay(popup, anchor, options);
  };
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  return () => {
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  };
}

/**
 * Dismisses an overlay when a pointer goes down outside it — the default the contract declares
 * through `capabilities.dismissOnOutsidePointer`. The decision itself is
 * `overlayLifecycleTransition`, so "outside" never means something different per renderer; this
 * only reports where the pointer landed and runs the teardown the policy asks for.
 */
function asNode(value: unknown): Node | null {
  return value !== null && typeof value === "object" && typeof (value as { nodeType?: unknown }).nodeType === "number"
    ? (value as Node)
    : null;
}

export function dismissOnOutsidePointer(
  parts: ReadonlyArray<Element | null | undefined>,
  isOpen: () => boolean,
  close: () => void,
): () => void {
  const onPointerDown = (event: Event): void => {
    if (!isOpen()) return;
    // Duck-typed rather than `instanceof Node`: the constructor is not a global in every host
    // this renderer runs in (a jsdom harness without it, an SSR shim), and a missed check would
    // silently stop dismissing.
    const target = asNode(event.target);
    const inside = target !== null && parts.some((part) => part?.contains(target));
    const transition = overlayLifecycleTransition({ open: true }, { type: "outside", outside: !inside });
    if (transition.effect === "teardown") close();
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}
