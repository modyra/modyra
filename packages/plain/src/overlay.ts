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
  /** The edge the widget's popup hangs from, as its contract declares it. */
  readonly alignment?: "left" | "right";
}

/**
 * The shape an open popup was given, kept so repositioning follows the anchor without re-deciding
 * the popup's side and height on every scroll frame. Cleared when it closes.
 */
const heldDecisions = new WeakMap<HTMLElement, { decision: MdyOverlayDecision; content: MdyContentSize | null }>();

interface MdyContentSize {
  readonly height: number;
  readonly width: number;
}

/** Forgets a popup's held shape, so the next opening decides afresh. */
export function releaseOverlayPlacement(popup: HTMLElement): void {
  heldDecisions.delete(popup);
}

/**
 * How much room the popup's content actually wants.
 *
 * `scrollHeight`/`scrollWidth` are the content's own size whatever `max-height` is clamping the box
 * to, which is exactly the question: a popup already squeezed into 200px still reports the 400px it
 * would like. The borders are added because the placement reasons about the whole box.
 *
 * Measured once, when the popup opens — re-measuring on every scroll frame would feed the clamped
 * width back into the decision that clamped it.
 */
function measureContent(popup: HTMLElement): MdyContentSize | null {
  const height = popup.scrollHeight;
  const width = popup.scrollWidth;
  // Nothing laid out: a popup still hidden has no size, and a guessed one is worse than none.
  if (height === 0 && width === 0) return null;
  const borderY = Math.max(0, popup.offsetHeight - popup.clientHeight);
  const borderX = Math.max(0, popup.offsetWidth - popup.clientWidth);
  return { height: height + borderY, width: width + borderX };
}

/** Positions `popup` against `anchor` by applying the contract's anchoring, and returns its decision. */
export function positionOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  options: OverlayPlacementOptions = {},
): MdyOverlayDecision {
  const rect = anchor.getBoundingClientRect();
  const held = heldDecisions.get(popup);
  // Measured on the way up, so the popup is placed where its content shows whole; kept afterwards,
  // so following the anchor never re-measures a box the placement has already clamped.
  const content = held ? held.content : measureContent(popup);
  // Every coordinate, the placement and the height come from `anchorOverlay`; this renderer only
  // measures and writes. Passing the decision it is already holding keeps an open popup's shape
  // steady while the anchor moves.
  const anchoring = anchorOverlay(
    rect,
    // `clientWidth`/`clientHeight`, never `innerWidth`/`innerHeight`: the inner sizes include the
    // scrollbars, while the coordinates written back are laid out against the viewport without
    // them. A right-hung popup then gets `right: innerWidth - anchor.right`, which is a scrollbar
    // too much, and every popup on a scrolling page sits ~15px left of its control.
    { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    {
      ...options,
      current: held?.decision ?? null,
      ...(content ? { contentHeight: content.height, contentWidth: content.width } : {}),
    },
  );
  heldDecisions.set(popup, { decision: anchoring.decision, content });
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
