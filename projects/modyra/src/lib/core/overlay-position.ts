/**
 * Lightweight overlay positioning — inspired by CDK Overlay but stripped
 * to the essentials needed by modyra dropdowns.
 *
 * Corner-selection strategy (two-pass, viewport space only):
 *   Pass 1 — perfect fit: the popup must fully fit (`minSpace`) in the
 *     visible viewport space on the preferred side (below by default),
 *     then on the other side. For each side, the "closest" horizontal
 *     corner is tried first: if clickX falls in the right half of the
 *     trigger → right-align, otherwise left-align (trigger center when
 *     no clickX is available).
 *   Pass 2 — best fit: if neither side fully fits, pick the side with
 *     more visible space, provided it offers at least ~80px (enough for
 *     one or two items; the panel then scrolls internally via max-height).
 *   Fallback — centered modal if no corner fits in either pass.
 *
 * NOTE: all viewport width/height measurements use clientWidth/clientHeight
 * (excludes scrollbar) rather than innerWidth/innerHeight (includes scrollbar)
 * to avoid a systematic ~16px right-offset on pages with a visible scrollbar.
 *
 * Once a corner is chosen it is locked; scroll updates use
 * `computeCoordsForAnchor` to follow the trigger without re-running this
 * selection algorithm.
 */

/** Resolved position strategy for the popup. */
export type OverlayPosition = "below" | "above" | "overlay";
/** Horizontal alignment relative to the trigger. */
export type OverlayAlignment = "left" | "right";

/**
 * Anchor for overlay positioning: either a live DOM element (rect is computed
 * at call time via getBoundingClientRect) or a pre-computed DOMRect (useful for
 * virtual / custom anchor areas not tied to a specific element).
 *
 * When a DOMRect is used, scroll-aware space is not available (no DOM ancestor
 * to traverse); the algorithm uses viewport-only space in both passes.
 */
export type OverlayAnchor = HTMLElement | DOMRect;

/** Result of an overlay position calculation. */
export interface ComputedPosition {
  readonly position: OverlayPosition;
  readonly alignment: OverlayAlignment;
  /** Viewport coordinates for fixed positioning. */
  readonly coords: {
    readonly top?: number | undefined;
    readonly bottom?: number | undefined;
    readonly left?: number | undefined;
    readonly right?: number | undefined;
    readonly width?: number | undefined;
  };
}

/**
 * Helper to convert ComputedPosition coordinates into CSS variables.
 * Explicitly unset unused properties to prevent inheritance and avoid the -9999px fallback.
 */
export function getOverlayStyles(c: ComputedPosition["coords"]) {
  return {
    "--mdy-overlay-top": c.top !== undefined ? `${c.top}px` : "unset",
    "--mdy-overlay-bottom": c.bottom !== undefined ? `${c.bottom}px` : "unset",
    "--mdy-overlay-left": c.left !== undefined ? `${c.left}px` : "unset",
    "--mdy-overlay-right": c.right !== undefined ? `${c.right}px` : "unset",
  };
}

/** Configuration for overlay positioning. */
export interface OverlayPositionConfig {
  /** Minimum viewport space (px) required to place the popup below or above. */
  readonly minSpace?: number;
  /** Minimum horizontal viewport space (px) required for the popup. */
  readonly minWidth?: number;
  /** Preferred vertical position. Defaults to 'below'. */
  readonly preferredPosition?: "above" | "below";
  /**
   * Horizontal coordinate (clientX) of the event that triggered the overlay.
   * Used to determine which horizontal corner of the trigger to anchor to:
   * if clickX falls in the right half of the trigger → right-align (popup grows
   * leftward), otherwise left-align. When omitted, falls back to trigger center.
   */
  readonly clickX?: number;
}

const DEFAULT_MIN_SPACE = 128;
const DEFAULT_MIN_WIDTH = 250;

/** Gap in pixels between the trigger edge and the popup. */
const POPUP_GAP = 4;

/** Extract a DOMRect from an OverlayAnchor. */
function getRect(anchor: OverlayAnchor): DOMRect {
  return anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
}



/**
 * Recompute only the viewport coordinates for an already-chosen corner,
 * without re-running the corner-selection algorithm.
 *
 * Used during scroll to keep the overlay solidary with its anchor corner
 * without switching corners.
 */
export function computeCoordsForAnchor(
  anchor: OverlayAnchor,
  position: OverlayPosition,
  alignment: OverlayAlignment,
): ComputedPosition["coords"] {
  if (typeof document === "undefined") return {}; // SSR guard (B32)
  const rect = getRect(anchor);
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  return {
    width: rect.width,
    top: position === "below" ? rect.bottom + POPUP_GAP : undefined,
    bottom: position === "above" ? vh - rect.top + POPUP_GAP : undefined,
    left: alignment === "left" ? rect.left : undefined,
    right: alignment === "right" ? vw - rect.right : undefined,
  };
}

/**
 * Compute the best overlay position for a popup relative to an anchor.
 *
 * @param anchor  An HTMLElement (live rect + scroll-aware space) or a DOMRect
 *                (static rect, viewport-only space). Use DOMRect for virtual
 *                anchor areas not tied to a specific DOM element.
 * @param config  Optional configuration overrides.
 * @returns       The computed `ComputedPosition`.
 */
export function computeOverlayPosition(
  anchor: OverlayAnchor,
  config?: OverlayPositionConfig,
): ComputedPosition {
  if (typeof document === "undefined") {
    // SSR guard (B32): no viewport to measure — fall back to centered modal.
    return { position: "overlay", alignment: "left", coords: {} };
  }
  const minSpace = config?.minSpace ?? DEFAULT_MIN_SPACE;
  const minWidth = config?.minWidth ?? DEFAULT_MIN_WIDTH;
  const prefPos = config?.preferredPosition ?? "below";

  const rect = getRect(anchor);
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // ── Closest horizontal corner ────────────────────────────────────────────
  const referenceX = config?.clickX ?? rect.left + rect.width / 2;
  const triggerMidX = rect.left + rect.width / 2;
  const closestAlign: OverlayAlignment = referenceX >= triggerMidX ? "right" : "left";
  const otherAlign: OverlayAlignment = closestAlign === "left" ? "right" : "left";

  const positions: Array<"below" | "above"> =
    prefPos === "below" ? ["below", "above"] : ["above", "below"];

  const fitsLeft = rect.left + minWidth <= vw;
  const fitsRight = rect.right >= minWidth;

  /** Try to find a side (below/above) and alignment (left/right) that fully fits. */
  function tryFit(): ComputedPosition | null {
    const vBelow = Math.max(0, vh - rect.bottom);
    const vAbove = Math.max(0, rect.top);

    for (const pos of positions) {
      const view = pos === "below" ? vBelow : vAbove;
      // The popup must fit entirely in the visible viewport space.
      if (view < minSpace) continue;

      for (const align of [closestAlign, otherAlign]) {
        const hFit = vw >= minWidth ? (align === "left" ? fitsLeft : fitsRight) : true;
        if (hFit) {
          return {
            position: pos,
            alignment: align,
            coords: computeCoordsForAnchor(anchor, pos, align),
          };
        }
      }
    }
    return null;
  }

  // 1. Pass 1: Try perfect viewport fit on either side (100% visible).
  const pass1 = tryFit();
  if (pass1) return pass1;

  // 2. Pass 2: Try "best fit" vertical. Pick the side with MORE space.
  // We only do this if that space is > 80px (enough for at least 1-2 items).
  const vBelow = Math.max(0, vh - rect.bottom);
  const vAbove = Math.max(0, rect.top);

  if (vBelow >= 80 || vAbove >= 80) {
    const pos: "below" | "above" = vBelow >= vAbove ? "below" : "above";
    // Try both horizontal alignments to find the best fit, prioritizing the closest one.
    for (const align of [closestAlign, otherAlign]) {
      const hFit = align === "left" ? fitsLeft : fitsRight;
      if (hFit) {
        return {
          position: pos,
          alignment: align,
          coords: computeCoordsForAnchor(anchor, pos, align),
        };
      }
    }
  }

  // 3. Fallback — centered modal.

  return {
    position: "overlay",
    alignment: "left",
    coords: {},
  };
}
