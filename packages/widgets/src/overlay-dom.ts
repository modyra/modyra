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
