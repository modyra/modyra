/**
 * Positioning for the popups this renderer draws.
 *
 * The decision — above or below, left- or right-aligned, how tall, how wide — is
 * `decideOverlayPlacement` in `@modyra/widgets`; this file only measures the anchor and writes the
 * result out as the `--mdy-overlay-*` custom properties the shipped themes already read, which is
 * the same contract the Angular renderer fulfils.
 */
import {
  decideOverlayPlacement,
  overlayLifecycleTransition,
  stabilizeOverlayPlacement,
  type MdyOverlayDecision,
} from "@modyra/widgets";

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

/** Positions `popup` against `anchor` and returns the decision the widget policy made. */
export function positionOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  options: OverlayPlacementOptions = {},
): MdyOverlayDecision {
  const rect = anchor.getBoundingClientRect();
  const geometry = {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    anchorTop: rect.top,
    anchorBottom: rect.bottom,
    anchorLeft: rect.left,
    anchorRight: rect.right,
    anchorWidth: rect.width,
    minSpace: options.minSpace ?? 180,
    minWidth: options.minWidth ?? 160,
    preferred: options.preferred ?? ("below" as const),
  };
  // Coordinates follow the anchor; the side and the height are the decision taken when it opened.
  const decision = stabilizeOverlayPlacement(
    heldDecisions.get(popup) ?? null,
    decideOverlayPlacement(geometry),
    geometry,
  );
  heldDecisions.set(popup, decision);

  const gap = 6;
  const style = popup.style;
  style.setProperty("--mdy-overlay-left", decision.alignment === "left" ? `${Math.round(rect.left)}px` : "auto");
  style.setProperty("--mdy-overlay-right", decision.alignment === "right" ? `${Math.round(window.innerWidth - rect.right)}px` : "auto");
  style.setProperty("--mdy-overlay-max-height", `${Math.round(decision.maxHeight - gap)}px`);
  if (decision.placement === "above") {
    style.setProperty("--mdy-overlay-top", "auto");
    style.setProperty("--mdy-overlay-bottom", `${Math.round(window.innerHeight - rect.top + gap)}px`);
  } else {
    style.setProperty("--mdy-overlay-top", `${Math.round(rect.bottom + gap)}px`);
    style.setProperty("--mdy-overlay-bottom", "auto");
  }
  if (options.matchAnchorWidth) style.setProperty("--mdy-overlay-width", `${Math.round(decision.width)}px`);
  popup.dataset.placement = decision.placement;
  return decision;
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
