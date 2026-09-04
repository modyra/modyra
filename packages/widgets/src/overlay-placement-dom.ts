/**
 * Writing an anchoring decision onto a panel.
 *
 * Its own module, and not part of `overlay-dom.ts`, for a structural reason rather than a tidy one:
 * that file is a leaf every popup-owning module already depends on, and reaching from it to the
 * catalogue and to `overlay.ts` closes five cycles through `dismissal` and `overlay-branch`. This
 * sits above all three instead — the barrel imports it, and nothing else does.
 */
import { applyOverlayProperties } from "./overlay-dom.js";
import {
  popupAlignmentClass,
  popupPlacementClass,
  type MdyOverlayAlignment,
  type MdyOverlayAnchoring,
  type MdyOverlayPlacement,
} from "./overlay.js";
import type { MdyPopupWidgetKind } from "./catalog/contracts.js";

/**
 * Writes an anchoring decision onto a panel: its coordinates, and the classes that say where it went.
 *
 * Every renderer that places its own popup performs the same four writes after `anchorOverlay`
 * answers — the custom properties, the placement as data, the stale placement classes off, the new
 * ones on — and the order matters in one place: the classes come off before they go on, or a panel
 * that flipped from above to below wears both answers at once and the theme picks whichever the
 * stylesheet mentions last.
 *
 * Written per renderer, this is the shape that drifts. Two of them had already invented
 * `mdy-overlay-panel--above`, a name no stylesheet has ever matched, while the catalogue's own
 * spelling went unemitted — which is the failure `popupPlacementClass` was written to end, repeated
 * one level up in the code that calls it.
 */
/**
 * Every placement and every alignment, as keys rather than a list.
 *
 * A list would compile while missing one, and a placement nobody clears is a class a panel keeps
 * wearing after it has moved. As a total record the compiler refuses the omission the day the
 * vocabulary grows.
 */
const EVERY_PLACEMENT: Readonly<Record<MdyOverlayPlacement, true>> = {
  below: true, above: true, overlay: true,
};
const EVERY_ALIGNMENT: Readonly<Record<MdyOverlayAlignment, true>> = { left: true, right: true };

export function applyAnchoredOverlay(
  panel: HTMLElement,
  kind: MdyPopupWidgetKind,
  anchoring: MdyOverlayAnchoring,
): void {
  applyOverlayProperties(panel, anchoring.properties);
  panel.dataset["placement"] = anchoring.placement;
  // Off before on: a panel that has moved must not wear two answers at once.
  for (const placement of Object.keys(EVERY_PLACEMENT) as MdyOverlayPlacement[]) {
    const named = popupPlacementClass(kind, placement);
    if (named) panel.classList.remove(named);
  }
  for (const alignment of Object.keys(EVERY_ALIGNMENT) as MdyOverlayAlignment[]) {
    const named = popupAlignmentClass(kind, alignment);
    if (named) panel.classList.remove(named);
  }
  const placement = popupPlacementClass(kind, anchoring.placement);
  const alignment = popupAlignmentClass(kind, anchoring.decision.alignment);
  if (placement) panel.classList.add(placement);
  if (alignment) panel.classList.add(alignment);
}
