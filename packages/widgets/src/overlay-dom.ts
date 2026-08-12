/**
 * Showing a popup, as opposed to placing one.
 *
 * `overlay.ts` decides *where* a popup goes and stays free of the DOM. This decides *how it is
 * shown*, which cannot be: putting an element in the top layer is a DOM operation and nothing else.
 * The two are separate files so that the geometry stays testable without a document.
 */

/**
 * Shows or hides a popup, and puts it in the top layer while it is open.
 *
 * One place decides how a popup is shown, the way one place already decides where it is placed.
 * This began in the framework-free renderer, whose fields used to assign `popup.hidden` themselves
 * six times over; it is here because the top layer is not a renderer's idea, it is what the
 * anchoring contract needs to be true.
 *
 * `anchorOverlay` measures against the viewport and every adapter writes those coordinates for a
 * `position: fixed` box — which holds only while no ancestor is a containing block for fixed
 * descendants. Anything with `contain: layout` becomes one, and `container-type` (which the
 * foundation needs so a row can ask how wide its *form* is, rather than how wide the window is)
 * applies exactly that. A popup in the top layer is laid out against the viewport whatever its
 * ancestors do, so the coordinates stay true. It also stops a popup being clipped by an
 * `overflow: hidden` ancestor, which was a standing bug in its own right.
 *
 * `manual` rather than `auto`: light-dismiss would close the popup before an adapter's own
 * outside-pointer handling ran, and two things closing one popup is how a click-through appears.
 */
/**
 * Shows or hides a popup, and puts the backdrop under it when the placement is modal.
 *
 * The backdrop is what makes a modal one: the page behind stays visible and stops taking the
 * pointer. `MDY_SHARED_UI_CLASSES` names it, a theme paints it, and every adapter draws it — which
 * is the part that had gone wrong. One renderer wrote its colour as a literal, one drew it under
 * every open popup including the dropdowns, and one drew none at all, so the same contract produced
 * three different modals.
 *
 * Here rather than in each renderer, because "a modal dims what is behind it" is not a rendering
 * decision any of them gets to make differently.
 */
export function setOverlayOpen(popup: HTMLElement, open: boolean, modal = false): void {
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
  syncOverlayBackdrop(popup, open && modal);
}

/** Marks the backdrop this module owns, so it is never confused with one a renderer drew itself. */
const BACKDROP_OWNER = "mdyOverlayBackdrop";

/**
 * One backdrop per popup, in the popup's own document, removed when it closes.
 *
 * Placed immediately before the popup so it sits under it in paint order without a z-index race,
 * and marked so a renderer that draws its own — a framework whose template owns the element — is
 * left alone.
 *
 * Exported because the placement is often known a moment after the popup is shown: a renderer that
 * measures, decides and then places calls this with the answer rather than opening twice.
 */
export function syncOverlayBackdrop(popup: HTMLElement, wanted: boolean): void {
  const existing = popup.previousElementSibling as HTMLElement | null;
  const own = existing?.dataset?.[BACKDROP_OWNER] === "" ? existing : null;
  if (!wanted) {
    own?.remove();
    return;
  }
  if (own) return;
  const document = popup.ownerDocument;
  if (!document) return;
  const backdrop = document.createElement("div");
  backdrop.className = "mdy-overlay-backdrop";
  backdrop.dataset[BACKDROP_OWNER] = "";
  popup.parentElement?.insertBefore(backdrop, popup);
}

/**
 * Keeps a popup on its anchor while the page moves under it.
 *
 * Scroll and resize are the two ways an anchor's viewport position changes without the widget doing
 * anything, so a popup that does not listen for them drifts off its control.
 *
 * Two properties, and each was a defect before this existed in one place:
 *
 * **Passive.** A non-passive `scroll` listener tells the engine the handler may cancel the scroll, so
 * it cannot commit the frame until the handler returns — a listener that follows a scroll ends up
 * blocking it. Nothing here calls `preventDefault`.
 *
 * **One reposition per frame.** Scroll events fire far more often than frames, and each reposition
 * measures layout and then writes it. Left uncoalesced that is a read-write cycle several times per
 * frame, which is both the cost and the visible judder: the popup lands on a position the page has
 * already left. `requestAnimationFrame` collapses a burst into the single placement that will
 * actually be painted.
 *
 * Capture, because the scroll that moves an anchor is often on an ancestor pane rather than the
 * window, and a scroll event does not bubble from an element.
 *
 * It was written three times — once per renderer — and the three disagreed: one passed `passive`,
 * two did not, and none coalesced. A behaviour every adapter needs is one this package owes them.
 *
 * **Scrolling and resizing are not the same event.** A page that scrolls moves the anchor and
 * nothing else, so the popup follows while keeping the side and height it opened with — re-deciding
 * on every scroll frame is what makes a popup flip sides under the pointer. A viewport that changes
 * size changes what fits, so there the decision is taken again. Both renderers that place their own
 * popups had drawn that distinction and neither could use this function, which had one callback for
 * two questions.
 */
export interface MdyAnchoredOverlayTracking {
  /** The page moved: follow the anchor, keeping the placement the popup opened with. */
  reposition(): void;
  /** The viewport changed size: what fits changed, so decide again. Defaults to `reposition`. */
  reflow?(): void;
  isOpen(): boolean;
  /**
   * Whether to follow scrolling at all. A popup that covers the viewport rather than hanging off a
   * control has no anchor to follow, and binding a capture-phase scroll listener for it is cost
   * with no effect.
   */
  followsScroll?(): boolean;
}

export function trackAnchoredOverlay(tracking: MdyAnchoredOverlayTracking): () => void {
  const { reposition, isOpen } = tracking;
  const reflow = tracking.reflow ?? reposition;
  const followsScroll = tracking.followsScroll ?? (() => true);
  let frame = 0;

  const coalesce = (run: () => void) => (): void => {
    if (!isOpen() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (isOpen()) run();
    });
  };
  const onScroll = coalesce(reposition);
  const onResize = coalesce(reflow);

  const scrolls = followsScroll();
  window.addEventListener("resize", onResize, { passive: true });
  if (scrolls) window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener("resize", onResize);
    if (scrolls) {
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
    }
  };
}
