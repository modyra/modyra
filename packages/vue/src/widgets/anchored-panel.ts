/**
 * Keeping an open panel where its control is, and outside the field it belongs to.
 *
 * Until this existed, every panel in this package was a `hidden` div in the flow: anatomically
 * conformant and behaviourally inert. It drew the parts the contract names, and it appeared under
 * the field rather than against it, inherited the `overflow` and the stacking of every ancestor, and
 * stayed exactly where the document happened to put it while the page scrolled underneath.
 *
 * **Nothing here decides where a panel goes.** Which side it prefers, how much room it needs before
 * it flips, whether it matches the control's width, the gap, the class the placement wears — all of
 * that is the contract's, reached through `overlayAnchoringFor` and `anchorOverlay`. This file
 * measures two rectangles, hands them over, and writes back what comes out: the same division the
 * other renderers make, using the same doors, so a panel lands in the same place in every one.
 */
import { onScopeDispose, watch, type Ref } from "vue";
import {
  anchorOverlay,
  applyOverlayProperties,
  inlineDirectionOf,
  overlayAnchoringFor,
  popupAlignmentClass,
  popupPlacementClass,
  trackAnchoredOverlay,
  viewportSize,
  type MdyPopupWidgetKind,
} from "@modyra/widgets";

/** Takes the placement classes off, so a panel never wears two answers at once. */
const clearPlacement = (panel: HTMLElement, kind: MdyPopupWidgetKind): void => {
  // Spelled from the declared unions rather than guessed: the first version of this list invented
  // "start", "end" and "center", which the compiler refused — an alignment here is left or right.
  for (const placement of ["below", "above", "overlay"] as const) {
    const named = popupPlacementClass(kind, placement);
    if (named) panel.classList.remove(named);
  }
  for (const alignment of ["left", "right"] as const) {
    const named = popupAlignmentClass(kind, alignment);
    if (named) panel.classList.remove(named);
  }
};

/**
 * Positions `panel` against `anchor` while `isOpen` answers true, and follows it.
 *
 * Scroll and resize are handled by the contract's own loop rather than a listener written here: it
 * coalesces to one frame and knows which widgets follow a scrolling ancestor, and a second
 * implementation would be a second answer that drifts.
 */
export function useAnchoredPanel(options: {
  readonly kind: MdyPopupWidgetKind;
  readonly panel: Ref<HTMLElement | null>;
  readonly anchor: Ref<HTMLElement | null>;
  readonly isOpen: () => boolean;
}): void {
  const reposition = (): void => {
    const panel = options.panel.value;
    const anchor = options.anchor.value;
    if (!panel || !anchor || !options.isOpen()) return;

    const anchoring = anchorOverlay(anchor.getBoundingClientRect(), viewportSize(document), {
      ...overlayAnchoringFor(options.kind),
      // Read from the DOM, never assumed: the widget declares which *inline* edge it hangs from, and
      // only the live direction says which physical edge that is.
      direction: inlineDirectionOf(anchor),
    });

    applyOverlayProperties(panel, anchoring.properties);
    panel.dataset.placement = anchoring.placement;
    clearPlacement(panel, options.kind);
    const placement = popupPlacementClass(options.kind, anchoring.placement);
    const alignment = popupAlignmentClass(options.kind, anchoring.decision.alignment);
    if (placement) panel.classList.add(placement);
    if (alignment) panel.classList.add(alignment);
  };

  let untrack: (() => void) | null = null;
  watch(options.isOpen, (open) => {
    if (!open) {
      untrack?.();
      untrack = null;
      return;
    }
    // After the panel is in the document: measuring a box the renderer has not drawn yet returns
    // zeroes, and a panel placed against zeroes lands in the corner.
    queueMicrotask(() => {
      reposition();
      untrack ??= trackAnchoredOverlay({ reposition, isOpen: options.isOpen });
    });
  }, { immediate: true });

  onScopeDispose(() => { untrack?.(); untrack = null; });
}
