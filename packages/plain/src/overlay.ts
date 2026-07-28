/**
 * Positioning for the popups this renderer draws.
 *
 * The decision — above or below, left- or right-aligned, how tall, how wide — is
 * `decideOverlayPlacement` in `@modyra/widgets`; this file only measures the anchor and writes the
 * result out as the `--mdy-overlay-*` custom properties the shipped themes already read, which is
 * the same contract the Angular renderer fulfils.
 */
import { decideOverlayPlacement } from "@modyra/widgets";

export interface OverlayPlacementOptions {
  /** Smallest usable space before the popup flips or overlays. */
  readonly minSpace?: number;
  readonly minWidth?: number;
  readonly preferred?: "above" | "below";
  /** Write the decided width out; a content-sized popup leaves it alone. */
  readonly matchAnchorWidth?: boolean;
}

/** Positions `popup` against `anchor` and returns the decision the widget policy made. */
export function positionOverlay(
  popup: HTMLElement,
  anchor: HTMLElement,
  options: OverlayPlacementOptions = {},
): ReturnType<typeof decideOverlayPlacement> {
  const rect = anchor.getBoundingClientRect();
  const decision = decideOverlayPlacement({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    anchorTop: rect.top,
    anchorBottom: rect.bottom,
    anchorLeft: rect.left,
    anchorRight: rect.right,
    anchorWidth: rect.width,
    minSpace: options.minSpace ?? 180,
    minWidth: options.minWidth ?? 160,
    preferred: options.preferred ?? "below",
  });

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
