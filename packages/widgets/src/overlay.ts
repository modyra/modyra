/**
 * How an overlay attaches to the control that opened it.
 *
 * Anchoring is one decision, taken here: which side of the anchor the popup sits on, which edge it
 * aligns to, how tall it may grow, how wide it is, and the exact coordinates that follow from that.
 * Adapters measure the anchor and the viewport, apply the properties this returns, and decide
 * nothing themselves — three renderers each computing "below unless it doesn't fit" is three
 * chances for them to disagree about where a popup belongs.
 *
 * The output is deliberately a map of CSS custom properties rather than a style string: the
 * foundation already positions `.mdy-overlay` from `--mdy-overlay-*`, so an adapter's whole job is
 * to copy these onto the element.
 */
import { decideOverlayPlacement, stabilizeOverlayPlacement, type MdyOverlayDecision } from "./behavior.js";

/** A measured anchor, in viewport coordinates — a `DOMRect` satisfies it. */
export interface MdyAnchorRect {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
}

export interface MdyViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface MdyOverlayAnchorOptions {
  /** Smallest usable space before the popup flips to the other side or goes modal. */
  readonly minSpace?: number;
  /** Narrowest the popup may be, whatever the anchor measures. */
  readonly minWidth?: number;
  /** Which side to try first. */
  readonly preferred?: "above" | "below";
  /** Match the anchor's width (a select's list) or size to content (a calendar). */
  readonly matchAnchorWidth?: boolean;
  /** Distance between the anchor and the popup. */
  readonly gap?: number;
  /** Where the pointer opened it, so a popup follows the click rather than the element's centre. */
  readonly pointerX?: number;
  /**
   * The decision this overlay is already holding, if it is open. Passing it keeps the popup's side
   * and height steady while its anchor moves; omitting it decides afresh, which is what opening is.
   */
  readonly current?: MdyOverlayDecision | null;
  /**
   * Keep this side and edge, but measure the height again. For a host that already tracks which
   * corner an open popup chose and only wants it to stay there while the anchor moves.
   */
  readonly lock?: { readonly placement: MdyOverlayDecision["placement"]; readonly alignment: MdyOverlayDecision["alignment"] } | null;
}

export interface MdyOverlayAnchoring {
  readonly decision: MdyOverlayDecision;
  /** `--mdy-overlay-*` custom properties, ready to be written onto the popup. */
  readonly properties: Readonly<Record<string, string>>;
  /** Mirrors `decision.placement`, for adapters that also reflect it as a data attribute. */
  readonly placement: MdyOverlayDecision["placement"];
}

const DEFAULT_GAP = 6;

/**
 * Anchors an overlay against a measured control.
 *
 * A modal placement (`"overlay"`) is what happens when neither side of the anchor has room: the
 * popup stops chasing the control and centres itself, because a list squeezed into 40px of space
 * is worse than one that ignores the anchor.
 */
export function anchorOverlay(
  anchor: MdyAnchorRect,
  viewport: MdyViewportSize,
  options: MdyOverlayAnchorOptions = {},
): MdyOverlayAnchoring {
  const gap = options.gap ?? DEFAULT_GAP;
  const geometry = {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    anchorTop: anchor.top,
    anchorBottom: anchor.bottom,
    anchorLeft: anchor.left,
    anchorRight: anchor.right,
    anchorWidth: anchor.width,
    minSpace: options.minSpace ?? 180,
    minWidth: options.minWidth ?? 160,
    preferred: options.preferred ?? ("below" as const),
    ...(options.pointerX !== undefined ? { pointerX: options.pointerX } : {}),
  };
  const measured = decideOverlayPlacement(geometry);
  let decision: MdyOverlayDecision;
  if (options.lock) {
    // The height must be measured for the side being locked, not carried over from the side the
    // policy would otherwise have chosen — that is how a popup ends up taller than its own space.
    const room = options.lock.placement === "above"
      ? Math.max(0, anchor.top - 12)
      : Math.max(0, viewport.height - anchor.bottom - 12);
    decision = {
      ...measured,
      placement: options.lock.placement,
      alignment: options.lock.alignment,
      maxHeight: options.lock.placement === "overlay"
        ? measured.maxHeight
        : Math.max(geometry.minSpace, room),
    };
  } else {
    decision = stabilizeOverlayPlacement(options.current ?? null, measured, geometry);
  }

  const px = (value: number): string => `${Math.round(value)}px`;
  const properties: Record<string, string> = {
    "--mdy-overlay-max-height": px(Math.max(0, decision.maxHeight - gap)),
  };

  if (decision.placement === "overlay") {
    // Centred on the viewport: there is no side left to attach to.
    properties["--mdy-overlay-top"] = "50%";
    properties["--mdy-overlay-bottom"] = "auto";
    properties["--mdy-overlay-left"] = "50%";
    properties["--mdy-overlay-right"] = "auto";
    properties["--mdy-overlay-transform"] = "translate(-50%, -50%)";
    properties["--mdy-overlay-max-height"] = px(Math.round(viewport.height * 0.7));
    if (options.matchAnchorWidth) properties["--mdy-overlay-width"] = px(decision.width);
    return { decision, properties, placement: decision.placement };
  }

  properties["--mdy-overlay-transform"] = "none";
  if (decision.placement === "above") {
    properties["--mdy-overlay-top"] = "auto";
    properties["--mdy-overlay-bottom"] = px(viewport.height - anchor.top + gap);
  } else {
    properties["--mdy-overlay-top"] = px(anchor.bottom + gap);
    properties["--mdy-overlay-bottom"] = "auto";
  }

  if (decision.alignment === "right") {
    properties["--mdy-overlay-left"] = "auto";
    properties["--mdy-overlay-right"] = px(viewport.width - anchor.right);
  } else {
    properties["--mdy-overlay-left"] = px(anchor.left);
    properties["--mdy-overlay-right"] = "auto";
  }

  if (options.matchAnchorWidth) properties["--mdy-overlay-width"] = px(decision.width);

  return { decision, properties, placement: decision.placement };
}
