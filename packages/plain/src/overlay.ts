/**
 * Positioning for the popups this renderer draws.
 *
 * Every decision — above or below, left- or right-aligned, how tall, how wide, and the exact
 * coordinates that follow — is `anchorOverlay` in `@modyra/widgets`. This file measures the anchor
 * and writes the `--mdy-overlay-*` properties it returns, and decides nothing of its own.
 */
import { anchorOverlay, overlayLifecycleTransition, popupPlacementClass, type MdyOverlayDecision, type MdyPopupWidgetKind } from "@modyra/widgets";

export interface OverlayPlacementOptions {
  /** Smallest usable space before the popup flips or overlays. */
  readonly minSpace?: number;
  readonly minWidth?: number;
  readonly preferred?: "above" | "below";
  /** Write the decided width out; a content-sized popup leaves it alone. */
  readonly matchAnchorWidth?: boolean;
  /** The edge the widget's popup hangs from, as its contract declares it. */
  readonly alignment?: "left" | "right";
  /** Which widget this popup belongs to, so its placement is reflected under the contract's name. */
  readonly kind?: MdyPopupWidgetKind;
}

/**
 * Shows or hides a popup, and puts it in the top layer while it is open.
 *
 * One place decides how a popup is shown, the way one place already decides where it is placed. The
 * fields used to assign `popup.hidden` themselves, six times over.
 *
 * The top layer is not decoration. `anchorOverlay` measures against the viewport and this renderer
 * writes those coordinates for a `position: fixed` box — which holds only while no ancestor is a
 * containing block for fixed descendants. Anything with `contain: layout` becomes one, and
 * `container-type` (which the foundation needs so a row can ask how wide its *form* is, rather than
 * how wide the window is) applies exactly that. A popup in the top layer is laid out against the
 * viewport whatever its ancestors do, so the coordinates stay true. It also stops a popup being
 * clipped by an `overflow: hidden` ancestor, which was a standing bug in its own right.
 *
 * `manual` rather than `auto`: light-dismiss would close the popup before this renderer's own
 * outside-pointer handling ran, and two things closing one popup is how a click-through appears.
 */
export function setOverlayOpen(popup: HTMLElement, open: boolean): void {
  if (popup.getAttribute("popover") !== "manual") popup.setAttribute("popover", "manual");
  popup.hidden = !open;
  // `showPopover` throws when the element is already showing, is disconnected, or the browser has no
  // popover support. None of those should take the field down: `hidden` alone still shows and hides
  // it, so the popup degrades to where it was before this — visible, in flow's terms, and anchored.
  try {
    if (open) popup.showPopover();
    else popup.hidePopover();
  } catch {
    // Nothing to do: the attribute and `hidden` already carry the state.
  }
}

/**
 * The placement, written onto the popup as the state the catalog declares for it.
 *
 * The coordinates alone are enough to *put* the popup somewhere; they cannot tell a stylesheet
 * which side it ended up on. A multiselect opening upwards wants its filter box nearest the
 * trigger, and no amount of `top`/`left` expresses that. The catalog already declares `above` and
 * `overlay` as states of every popup part, so this asks `partClasses` for the answer rather than
 * spelling a modifier here — which is how `mdy-overlay-panel--above`, a name no stylesheet has ever
 * matched, came to exist in two adapters at once.
 *
 * "below" is the ordinary case and carries no class, exactly as the catalog documents.
 */
function reflectPlacement(popup: HTMLElement, kind: MdyPopupWidgetKind, placement: MdyOverlayDecision["placement"]): void {
  for (const state of ["above", "overlay"] as const) {
    const modifier = popupPlacementClass(kind, state);
    if (modifier) popup.classList.toggle(modifier, placement === state);
  }
}

/** Removes whichever placement state a popup is wearing, so a closed popup carries none. */
function clearPlacement(popup: HTMLElement, kind: MdyPopupWidgetKind): void {
  reflectPlacement(popup, kind, "below");
}

/**
 * The shape an open popup was given, kept so repositioning follows the anchor without re-deciding
 * the popup's side and height on every scroll frame. Cleared when it closes.
 */
const heldDecisions = new WeakMap<HTMLElement, { decision: MdyOverlayDecision; content: MdyContentSize | null; kind?: MdyPopupWidgetKind }>();

interface MdyContentSize {
  readonly height: number;
  readonly width: number;
}

/**
 * Forgets a popup's held shape, so the next opening decides afresh — and takes its placement state
 * off with it, because a closed popup is not sitting above anything. The kind is read back from the
 * held decision rather than asked of the caller, so closing needs to know no more than it did.
 */
export function releaseOverlayPlacement(popup: HTMLElement): void {
  const held = heldDecisions.get(popup);
  if (held?.kind) clearPlacement(popup, held.kind);
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
  heldDecisions.set(popup, { decision: anchoring.decision, content, ...(options.kind ? { kind: options.kind } : {}) });
  for (const [property, value] of Object.entries(anchoring.properties)) {
    popup.style.setProperty(property, value);
  }
  popup.dataset.placement = anchoring.placement;
  if (options.kind) reflectPlacement(popup, options.kind, anchoring.placement);
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
