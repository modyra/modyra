/**
 * Keeping an open panel where its control is, and outside the field it belongs to.
 *
 * **Nothing here decides where a panel goes.** Which side it prefers, how much room it needs before
 * it flips, whether it matches the control's width, the gap, the class the placement wears — all of
 * that is the contract's, reached through `overlayAnchoringFor` and `anchorOverlay`. This hook
 * measures two rectangles, hands them over, and writes back what comes out: the same division every
 * renderer makes, through the same doors, so a panel lands in the same place in each of them.
 *
 * The classes are written straight onto the element rather than rendered, because placement is
 * decided from a measurement taken after the panel is drawn. Rendering it would mean a state write
 * inside a layout effect on every scroll frame, and a second render for a class the element already
 * carries.
 */
import { useEffect, useRef, type RefObject } from "react";
import {
  anchorOverlay,
  applyAnchoredOverlay,
  inlineDirectionOf,
  overlayAnchoringFor,
  trackAnchoredOverlay,
  viewportSize,
  type MdyPopupWidgetKind,
} from "@modyra/widgets";

export interface UseMdyAnchoredPanelOptions {
  readonly kind: MdyPopupWidgetKind;
  readonly panel: RefObject<HTMLElement | null>;
  readonly anchor: RefObject<HTMLElement | null>;
  readonly isOpen: boolean;
}

/**
 * Positions `panel` against `anchor` while the panel is open, and follows it.
 *
 * Scroll and resize are handled by the contract's own loop rather than listeners written here: it
 * coalesces to one frame and knows which widgets follow a scrolling ancestor, and a second
 * implementation would be a second answer that drifts.
 */
export function useMdyAnchoredPanel(options: UseMdyAnchoredPanelOptions): void {
  // Held in a ref so the tracking loop calls the current one: the loop is started once per opening
  // and would otherwise keep the closure from the render that opened the panel, measuring against
  // an anchor the component has since replaced.
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!options.isOpen) return;

    const reposition = (): void => {
      const { panel, anchor, kind, isOpen } = latest.current;
      const panelElement = panel.current;
      const anchorElement = anchor.current;
      if (!panelElement || !anchorElement || !isOpen) return;

      const anchoring = anchorOverlay(anchorElement.getBoundingClientRect(), viewportSize(document), {
        ...overlayAnchoringFor(kind),
        // Read from the DOM, never assumed: the widget declares which *inline* edge it hangs from,
        // and only the live direction says which physical edge that is.
        direction: inlineDirectionOf(anchorElement),
      });

      // The coordinates and the classes that say where it went, written by the contract's own door:
      // the four writes and the order they go in are the same in every renderer that places a popup.
      applyAnchoredOverlay(panelElement, kind, anchoring);
    };

    reposition();
    const untrack = trackAnchoredOverlay({ reposition, isOpen: () => latest.current.isOpen });
    return untrack;
  }, [options.isOpen]);
}
