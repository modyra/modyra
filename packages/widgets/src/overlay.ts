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
import { MDY_WIDGET_CONTRACTS, type MdyPopupWidgetKind, type MdyWidgetKind } from "./catalog.js";
import { MDY_CSS_PROPERTIES } from "./css.js";
import {
  decideOverlayPlacement,
  stabilizeOverlayPlacement,
  MDY_OVERLAY_VIEWPORT_MARGIN,
  type MdyOverlayDecision,
} from "./behavior.js";

/**
 * Which side of its anchor the popup sits on. `"overlay"` is the case where neither side had room
 * and the popup centred itself on the viewport instead.
 */
export type MdyOverlayPlacement = MdyOverlayDecision["placement"];

/** Which edge of its anchor the popup hangs from. */
export type MdyOverlayAlignment = MdyOverlayDecision["alignment"];

/**
 * Where a popup ends up, in viewport coordinates.
 *
 * For a host that positions its panel itself — Angular hands these to the CDK — rather than by
 * copying the custom properties onto the element. Same decision, read a different way.
 */
export interface MdyOverlayCoords {
  readonly top?: number | undefined;
  readonly bottom?: number | undefined;
  readonly left?: number | undefined;
  readonly right?: number | undefined;
  readonly width?: number | undefined;
  /** The widest the popup may be where it now sits — the room measured on the side it hangs from.
   * Without it a content-sized popup near a viewport edge shows half off the screen. */
  readonly maxWidth?: number | undefined;
}

/** A placed popup: the side, the edge, and the coordinates that follow from them. */
export interface MdyOverlayPlacementResult {
  readonly position: MdyOverlayPlacement;
  readonly alignment: MdyOverlayAlignment;
  readonly coords: MdyOverlayCoords;
}

/**
 * Coordinates as the custom properties the foundation positions from.
 *
 * Every unused coordinate is written as `unset` rather than left out: a popup that moves from
 * hanging left to hanging right must stop having a `left`, and a property left in place from the
 * previous placement is inherited and quietly wins.
 */
export function overlayStyleProperties(coords: MdyOverlayCoords): Readonly<Record<string, string>> {
  const prop = MDY_CSS_PROPERTIES.overlay;
  const px = (value: number | undefined): string => (value !== undefined ? `${value}px` : "unset");
  return Object.freeze({
    [prop.top]: px(coords.top),
    [prop.bottom]: px(coords.bottom),
    [prop.left]: px(coords.left),
    [prop.right]: px(coords.right),
    [prop.maxWidth]: px(coords.maxWidth),
  });
}

/** A measured anchor, in viewport coordinates — a `DOMRect` satisfies it. */
export interface MdyAnchorRect {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
}

/**
 * The viewport the coordinates are laid out against.
 *
 * `document.documentElement.clientWidth`/`clientHeight` — the viewport *without* the scrollbars.
 * `window.innerWidth`/`innerHeight` include them, and a popup pinned by its right or bottom edge
 * then sits a scrollbar's width away from its control on any page long enough to scroll.
 */
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
  /**
   * The popup's own height, measured by the host — `scrollHeight` is exactly this, since it reports
   * the content's full height whatever `max-height` is currently clamping it to.
   *
   * Supplying it is what lets the policy put the popup where it shows whole: a side is chosen
   * because the content fits there, not merely because the side is big enough to bother with. Left
   * out, placement falls back to the minimum-space rule and the popup may scroll.
   */
  readonly contentHeight?: number;
  /** The popup's own width, measured the same way, so its edge is chosen where the content fits. */
  readonly contentWidth?: number;
  /**
   * The edge the popup hangs from, as the widget's `capabilities.anchoring` declares it. Stated, it
   * decides; only a content width that will not fit that side can overrule it.
   */
  readonly alignment?: "left" | "right";
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
  /**
   * Which widget is being anchored.
   *
   * `anchorOverlay` does not read it — placement is geometry, and geometry does not care what the
   * popup contains. It travels with the options so that a renderer holding an anchoring already
   * holds everything needed to reflect the result: the catalog declares `above` and `overlay` as
   * states of every popup part, and a renderer with the kind can name them through `partClasses`
   * instead of inventing a spelling of its own.
   */
  readonly kind?: MdyPopupWidgetKind;
}

export interface MdyOverlayAnchoring {
  readonly decision: MdyOverlayDecision;
  /** `--mdy-overlay-*` custom properties, ready to be written onto the popup. */
  readonly properties: Readonly<Record<string, string>>;
  /** Mirrors `decision.placement`, for adapters that also reflect it as a data attribute. */
  readonly placement: MdyOverlayDecision["placement"];
}

/** The breathing space between a control and its popup, when the caller does not say otherwise. */
export const MDY_OVERLAY_GAP = 6;

/**
 * The anchoring a widget declares, as options for {@link anchorOverlay}.
 *
 * The one call an adapter needs: how wide the popup is, how much room it wants and which edge it
 * hangs from all come from the catalog, so a renderer never holds a number of its own. Three
 * renderers each carrying their own `minSpace` is three widgets that behave differently while
 * appearing to share a contract.
 *
 * Returns an empty object for a widget with no popup, so a caller can pass it unconditionally.
 */
export function overlayAnchoringFor(kind: MdyWidgetKind): MdyOverlayAnchorOptions {
  const anchoring = MDY_WIDGET_CONTRACTS[kind].capabilities.anchoring;
  if (!anchoring) return {};
  return {
    // A widget that declares anchoring declares a popup to anchor — the two travel together in the
    // catalog, and `popupKindsDeclareAnchoring` in the widgets suite is what keeps them together.
    // The guard above proves it at runtime; TypeScript cannot narrow a key by a sibling's value.
    kind: kind as MdyPopupWidgetKind,
    matchAnchorWidth: anchoring.matchAnchorWidth,
    minSpace: anchoring.minSpace,
    ...(anchoring.minWidth !== undefined ? { minWidth: anchoring.minWidth } : {}),
    ...(anchoring.alignment !== undefined ? { alignment: anchoring.alignment } : {}),
  };
}

const clamp = (value: number, low: number, high: number): number =>
  high < low ? low : Math.min(Math.max(value, low), high);

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
  const gap = options.gap ?? MDY_OVERLAY_GAP;
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
    // The popup needs its own height *plus* the gap it must leave: the space it is given is the
    // room minus that gap, so comparing the bare content height would call a squeeze a fit.
    ...(options.contentHeight !== undefined ? { desiredHeight: options.contentHeight + gap } : {}),
    ...(options.contentWidth !== undefined ? { desiredWidth: options.contentWidth } : {}),
    ...(options.alignment !== undefined ? { preferredAlignment: options.alignment } : {}),
  };
  const measured = decideOverlayPlacement(geometry);
  let decision: MdyOverlayDecision;
  if (options.lock) {
    // The height must be measured for the side being locked, not carried over from the side the
    // policy would otherwise have chosen — that is how a popup ends up taller than its own space.
    const room = options.lock.placement === "above"
      ? Math.max(0, anchor.top - MDY_OVERLAY_VIEWPORT_MARGIN)
      : Math.max(0, viewport.height - anchor.bottom - MDY_OVERLAY_VIEWPORT_MARGIN);
    const maxHeight = options.lock.placement === "overlay"
      ? measured.maxHeight
      : Math.max(geometry.minSpace, room);
    decision = {
      ...measured,
      placement: options.lock.placement,
      alignment: options.lock.alignment,
      maxHeight,
      // Whether the content still shows whole is about the side that is locked, not the side the
      // policy would have picked.
      fits: geometry.desiredHeight === undefined
        ? true
        : (options.lock.placement === "overlay" ? maxHeight : room) >= geometry.desiredHeight,
    };
  } else {
    decision = stabilizeOverlayPlacement(options.current ?? null, measured, geometry);
  }

  const px = (value: number): string => `${Math.round(value)}px`;
  const prop = MDY_CSS_PROPERTIES.overlay;
  const properties: Record<string, string> = {
    [prop.maxHeight]: px(Math.max(0, decision.maxHeight - gap)),
  };

  const margin = MDY_OVERLAY_VIEWPORT_MARGIN;
  // The widest a popup may ever be. Emitted on every placement so a popup whose width nobody
  // measured still cannot run off the screen: the coordinates below keep it inside the viewport,
  // and this keeps it inside on its own if a theme sizes it from its content.
  const spannable = Math.max(0, viewport.width - margin * 2);

  if (decision.placement === "overlay") {
    // Centred on the viewport: there is no side left to attach to.
    properties[prop.top] = "50%";
    properties[prop.bottom] = "auto";
    properties[prop.left] = "50%";
    properties[prop.right] = "auto";
    properties[prop.transform] = "translate(-50%, -50%)";
    properties[prop.maxHeight] = px(Math.round(viewport.height * 0.7));
    properties[prop.maxWidth] = px(spannable);
    if (options.matchAnchorWidth) properties[prop.width] = px(decision.width);
    return { decision, properties, placement: decision.placement };
  }

  properties[prop.transform] = "none";
  if (decision.placement === "above") {
    properties[prop.top] = "auto";
    properties[prop.bottom] = px(viewport.height - anchor.top + gap);
  } else {
    properties[prop.top] = px(anchor.bottom + gap);
    properties[prop.bottom] = "auto";
  }

  // Horizontally the popup hangs from one edge of its anchor, and stays inside the viewport.
  //
  // Hanging alone is not enough: a content-sized calendar on a narrow control near the right edge
  // hangs left and runs off the screen, which is the half-visible popup this arithmetic exists to
  // prevent. So the width the popup will actually take — the anchor's when it matches it, the
  // measured one otherwise — is checked against the room on the chosen side, and when it does not
  // fit the popup is moved bodily inside the viewport rather than left hanging over the edge.
  const width = options.matchAnchorWidth ? decision.width : options.contentWidth;
  const roomFromEdge = decision.alignment === "right"
    ? anchor.right - margin // hanging leftwards from the anchor's right edge
    : viewport.width - anchor.left - margin; // hanging rightwards from its left edge
  // With no measurement the minimum width is the only thing known about how much room is wanted.
  const wanted = width ?? Math.min(geometry.minWidth, spannable);

  if (wanted <= roomFromEdge) {
    if (decision.alignment === "right") {
      properties[prop.left] = "auto";
      properties[prop.right] = px(viewport.width - anchor.right);
    } else {
      properties[prop.left] = px(anchor.left);
      properties[prop.right] = "auto";
    }
    properties[prop.maxWidth] = px(Math.min(spannable, roomFromEdge));
  } else {
    // Pushed back inside: both coordinates are stated, because a popup that is no longer aligned to
    // its anchor's edge has no edge left to inherit.
    const span = Math.min(wanted, spannable);
    const hanging = decision.alignment === "right" ? anchor.right - span : anchor.left;
    const left = clamp(hanging, margin, viewport.width - span - margin);
    properties[prop.left] = px(left);
    properties[prop.right] = "auto";
    properties[prop.maxWidth] = px(spannable);
  }

  if (options.matchAnchorWidth) properties[prop.width] = px(decision.width);

  return { decision, properties, placement: decision.placement };
}
