/**
 * Where an overlay goes, and how it attaches to the control that opened it.
 *
 * One decision and one file. The geometry — a rectangle, a viewport and a margin deciding a side and
 * an alignment — lived apart from the anchoring that reads it, which put `MDY_OVERLAY_VIEWPORT_MARGIN`
 * and `MDY_OVERLAY_GAP` in two different modules. Two constants that govern the same decision have to
 * be read together or they are not a rule.
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
import { partClasses } from "./part-classes.js";
import { MDY_CSS_PROPERTIES } from "./css.js";

/**
 * Which side of its anchor the popup sits on. `"overlay"` is the case where neither side had room
 * and the popup centred itself on the viewport instead.
 */
// ─── Geometry: where it goes ──────────────────────────────────────────────────

export const MDY_OVERLAY_VIEWPORT_MARGIN = 12;

/**
 * What raised a panel, because it decides where the keyboard goes next.
 *
 * A keyboard open is followed by a keypress, so focus must be where that press will land. A pointer
 * open is followed by a click, and moving focus into the panel scrolls it under the pointer and
 * draws a ring on something nobody touched. One rule reading the modality, rather than two
 * behaviours for one control. ADR 0179.
 */
export type MdyOpenModality = "keyboard" | "pointer";

export interface MdyOverlayGeometry {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly anchorTop: number;
  readonly anchorBottom: number;
  readonly anchorLeft: number;
  readonly anchorRight: number;
  readonly anchorWidth: number;
  readonly minSpace: number;
  /** Whether the content scrolls. `false` means a side that cannot hold it is not a placement. */
  readonly scrolls?: boolean;
  readonly minWidth: number;
  readonly preferred: "above" | "below";
  readonly pointerX?: number;
  /**
   * How tall the popup wants to be, gap included, when the host has measured it.
   *
   * This is what turns "a side with enough room" into "the side where the content is whole": a
   * calendar with 200px below it and 500px above belongs above, and a policy that only knows
   * `minSpace` puts it below and lets it scroll. Left out when nothing measured the popup, in which
   * case the choice falls back to the minimum-space rule.
   */
  readonly desiredHeight?: number;
  /** How wide the popup wants to be, when measured. Used to pick the edge its content fits from. */
  readonly desiredWidth?: number;
  /**
   * The edge the widget says its popup hangs from, from `capabilities.anchoring`.
   *
   * A widget knows where its trigger is — the arrow, the calendar button, the swatch all sit at the
   * end of the control — and that is the edge a popup should open from, every time. When a widget
   * states it, it wins: the pointer and the anchor's position on the page decide nothing, because a
   * popup that opens from a different corner depending on where you clicked inside the same field is
   * the behaviour this exists to stop. Only the viewport can overrule it, and only when the content
   * would not fit.
   */
  readonly preferredAlignment?: "left" | "right";
  /**
   * Take the modal placement whatever the room, because the host asked for it.
   *
   * The placement itself is not new — it is where a popup goes when neither side holds it, and
   * ADR 0023 names it the modal placement. What was missing is the host being able to *choose* it: a
   * picker that covers the viewport on a phone, or one a product wants modal on every screen, had to
   * hope the geometry refused every side.
   *
   * Presentation and nothing else. What a widget commits, and when, is the value contract's answer
   * (`MDY_VALUE_CONTRACTS`), and a placement never changes it.
   */
  readonly forceModal?: boolean;
}

export interface MdyOverlayDecision {
  readonly placement: "above" | "below" | "overlay";
  readonly alignment: "left" | "right";
  readonly maxHeight: number;
  readonly width: number;
  /**
   * Whether the content fits the space decided for it, so the popup shows whole and does not
   * scroll. `true` when nothing measured the popup: no measurement is not evidence of a squeeze.
   */
  readonly fits: boolean;
}

/** Room between an anchor and the viewport edge on either side, margin already taken off. */
function roomAround(input: MdyOverlayGeometry): { readonly above: number; readonly below: number } {
  return {
    above: Math.max(0, input.anchorTop - MDY_OVERLAY_VIEWPORT_MARGIN),
    below: Math.max(0, input.viewportHeight - input.anchorBottom - MDY_OVERLAY_VIEWPORT_MARGIN),
  };
}

/** Pure framework-independent overlay collision policy. Hosts only measure and apply coordinates. */
export function decideOverlayPlacement(input: MdyOverlayGeometry): MdyOverlayDecision {
  const { above, below } = roomAround(input);
  const desired = input.desiredHeight;
  const other = input.preferred === "below" ? "above" : "below";
  const roomOn = (side: "above" | "below"): number => (side === "above" ? above : below);

  let placement: MdyOverlayDecision["placement"];
  if (input.forceModal === true) {
    // Asked for, so nothing is weighed: a host that says modal is not making a suggestion the room
    // can overrule.
    placement = "overlay";
  } else if (desired !== undefined && roomOn(input.preferred) >= desired) {
    // The side asked for holds the whole popup: nothing to weigh up.
    placement = input.preferred;
  } else if (desired !== undefined && roomOn(other) >= desired) {
    // The preferred side would have cut the content; the other side shows it whole.
    placement = other;
  } else if (input.preferred === "below" && below >= input.minSpace) placement = "below";
  else if (input.preferred === "above" && above >= input.minSpace) placement = "above";
  else if (Math.max(above, below) >= input.minSpace) placement = above > below ? "above" : "below";
  else placement = "overlay";

  // When the content is measured and neither side holds it, the roomier side is the one that cuts
  // it least. Without a measurement this cannot be known, so the rule above stands.
  if (desired !== undefined && placement !== "overlay" && roomOn(placement) < desired) {
    placement = above > below ? "above" : "below";
    // Content that does not scroll has one size, so a side that cannot hold it is not a placement at
    // all — it centres rather than being clamped into a scrollable stub of itself. Content that does
    // scroll takes the roomier side and scrolls there, which is what a long list is for; it only
    // centres when neither side is worth using.
    if (input.scrolls === false ? roomOn(placement) < desired : roomOn(placement) < input.minSpace) {
      placement = "overlay";
    }
  }

  let alignment = decideOverlayAlignment(input);

  /* Promotion is about the whole box, not its height.
   *
   * A popup that does not scroll must be shown entire, and "entire" has two axes: a calendar that
   * fits below its field and still runs off the right edge is as unusable as one that is clipped
   * short. The rule is therefore *no placement holds it completely* — neither side vertically, or
   * neither edge horizontally — rather than the vertical test alone, which would leave a popup
   * docked and clamped on the axis nobody checked.
   *
   * Scrolling content is untouched: a list is allowed to be clamped, which is what scrolling is. */
  if (input.scrolls === false && placement !== "overlay" && input.desiredWidth !== undefined) {
    const fromLeft = input.viewportWidth - input.anchorLeft - MDY_OVERLAY_VIEWPORT_MARGIN;
    const fromRight = input.anchorRight - MDY_OVERLAY_VIEWPORT_MARGIN;
    if (Math.max(fromLeft, fromRight) < input.desiredWidth) {
      placement = "overlay";
      alignment = decideOverlayAlignment(input);
    }
  }

  const modalHeight = Math.round(input.viewportHeight * 0.7);
  const maxHeight = placement === "overlay"
    ? modalHeight
    : Math.max(input.minSpace, roomOn(placement));
  const fits = desired === undefined
    ? true
    : (placement === "overlay" ? modalHeight : roomOn(placement)) >= desired;
  return { placement, alignment, maxHeight, width: Math.max(input.anchorWidth, input.minWidth), fits };
}

/**
 * Which edge of the anchor the popup hangs from.
 *
 * In order: the edge the widget declares, then — for a widget that declares none — the half of the
 * control the pointer landed in, and its position on the page when it was opened from the keyboard.
 * A measured width then overrules all of that when the chosen edge has no room for it: hanging left
 * off a control near the right edge is how a content-sized calendar ends up half off-screen.
 *
 * Note which comparison is *not* here any more: the pointer against the middle of the viewport. It
 * made the edge a popup opened from depend on where its field happened to sit on the page, so the
 * same calendar opened from the left corner on one form and the right corner on another.
 */
export function decideOverlayAlignment(input: MdyOverlayGeometry): MdyOverlayDecision["alignment"] {
  const anchorMiddle = (input.anchorLeft + input.anchorRight) / 2;
  const preferred = input.preferredAlignment
    ?? (input.pointerX !== undefined
      ? (input.pointerX >= anchorMiddle ? "right" : "left")
      : (anchorMiddle > input.viewportWidth / 2 ? "right" : "left"));
  const width = input.desiredWidth;
  if (width === undefined) return preferred;
  const fromLeft = input.viewportWidth - input.anchorLeft - MDY_OVERLAY_VIEWPORT_MARGIN;
  const fromRight = input.anchorRight - MDY_OVERLAY_VIEWPORT_MARGIN;
  const room = preferred === "right" ? fromRight : fromLeft;
  if (room >= width) return preferred;
  const otherRoom = preferred === "right" ? fromLeft : fromRight;
  // Only swap when the other edge is genuinely better; otherwise the coordinates get clamped and
  // swapping would just move the same overflow to the opposite side.
  return otherRoom > room ? (preferred === "right" ? "left" : "right") : preferred;
}

/**
 * Keeps an open overlay's shape steady while its anchor moves.
 *
 * Re-deciding from scratch on every scroll frame is what makes a popup flip sides and change
 * height as the page moves under it. The coordinates must follow the anchor — that is what keeps
 * the popup attached — but the *shape* is a decision taken when it opened: placement, size and
 * alignment only change when the side it was opened on has genuinely stopped fitting.
 *
 * Hosts call this with the decision they are holding and the one they just measured.
 */
export function stabilizeOverlayPlacement(
  previous: MdyOverlayDecision | null,
  next: MdyOverlayDecision,
  input: MdyOverlayGeometry,
): MdyOverlayDecision {
  if (previous === null) return next;
  const { above, below } = roomAround(input);
  const room = previous.placement === "above" ? above : below;
  // The side it opened on no longer holds the popup: re-deciding is the lesser evil.
  if (previous.placement !== "overlay" && room < input.minSpace) return next;
  return {
    placement: previous.placement,
    alignment: previous.alignment,
    maxHeight: previous.maxHeight,
    width: next.width,
    // Reported against the room the anchor has now: the shape is held, but whether the content
    // still shows whole is a fact about this frame, not about the frame it opened in.
    fits: input.desiredHeight === undefined
      ? true
      : (previous.placement === "overlay" ? previous.maxHeight : room) >= input.desiredHeight,
  };
}

/** Canonical keyboard mapping. Framework adapters must not reinterpret these keys. */

// ─── Anchoring: what that becomes ─────────────────────────────────────────────

export type MdyOverlayPlacement = MdyOverlayDecision["placement"];

/** Which edge of its anchor the popup hangs from. */
export type MdyOverlayAlignment = MdyOverlayDecision["alignment"];

/**
 * Where a popup ends up, in viewport coordinates.
 *
 * For a host that positions its panel itself, rather than by copying the custom properties onto the
 * element. Same decision, read a different way.
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
  /**
   * The tallest the popup may be on the side it was given, so a long list scrolls rather than
   * overflowing the viewport.
   *
   * Carried here rather than left to the host because it is the other half of the placement
   * decision: a side is chosen for the room it has, and the number describing that room has to
   * arrive with the coordinates or the popup grows past the space it was placed in.
   */
  readonly maxHeight?: number | undefined;
  /**
   * Which side the popup ended up on, because `"overlay"` is not a coordinate.
   *
   * A modal placement has given up on its anchor and centres itself on the viewport, which is a
   * percentage offset and a translation rather than the measured insets the other placements use.
   * Without the placement travelling with the numbers there is no way to serialise that from coords
   * alone, so every host on this path had to special-case it — and one of them picked a different
   * height for the modal than the policy did.
   */
  readonly placement?: MdyOverlayPlacement | undefined;
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
 * Every unused coordinate is written out rather than left off: a popup that moves from hanging left
 * to hanging right must stop having a `left`, and a property left in place from the previous
 * placement is inherited and quietly wins.
 *
 * An unused inset is `auto`, which is the value {@link anchorOverlay} writes and therefore the one
 * every theme has been reading. `unset` would leave `var()` invalid at computed-value time and let
 * a stylesheet fallback answer instead — a difference that only shows on the placements a host
 * exercises least, which is exactly where the two projections had already drifted apart.
 */
export function overlayStyleProperties(coords: MdyOverlayCoords): Readonly<Record<string, string>> {
  const prop = MDY_CSS_PROPERTIES.overlay;
  const px = (value: number | undefined): string => (value !== undefined ? `${Math.round(value)}px` : "auto");
  const height = px(coords.maxHeight);
  const width = px(coords.width);
  if (coords.placement === "overlay") {
    // Centred on the viewport: there is no side left to attach to, so the insets are replaced rather
    // than measured. The height is still the one the policy decided — a host that substitutes its
    // own makes the same widget a different size depending on which renderer drew it.
    return Object.freeze({
      [prop.top]: "50%",
      [prop.bottom]: "auto",
      [prop.left]: "50%",
      [prop.right]: "auto",
      [prop.transform]: "translate(-50%, -50%)",
      [prop.maxWidth]: px(coords.maxWidth),
      [prop.maxHeight]: height,
      [prop.width]: width,
    });
  }
  return Object.freeze({
    [prop.top]: px(coords.top),
    [prop.bottom]: px(coords.bottom),
    [prop.left]: px(coords.left),
    [prop.right]: px(coords.right),
    [prop.transform]: "none",
    [prop.maxWidth]: px(coords.maxWidth),
    [prop.maxHeight]: height,
    [prop.width]: width,
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
  /**
   * The writing direction the field is laid out in. Defaults to `"ltr"`.
   *
   * Only the **declared** alignment mirrors. `overlayAnchoringFor(kind)` says which edge of the
   * control a popup hangs from — the end where the trigger sits, the arrow, the calendar button —
   * and that is an inline idea: in a right-to-left field the same edge is the left one.
   *
   * Everything else here stays physical on purpose. How much room there is before the viewport's
   * right edge, and where the pointer landed, are facts about the screen and the user's hand; they
   * do not mirror, and a popup that ignored them would hang off the side of the window.
   */
  readonly direction?: "ltr" | "rtl";
  /** Distance between the anchor and the popup. */
  readonly gap?: number;
  /**
   * Whether this popup's content scrolls. Defaults to `true`, which is the behaviour every caller
   * had before it existed.
   *
   * `false` says the content has a size it must be shown at, so a side that cannot hold it is not a
   * placement — it centres instead of clamping. `overlayAnchoringFor` supplies it from the kind's
   * `capabilities.overlayScrolls`, so a renderer gets it without asking.
   */
  readonly scrolls?: boolean;
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
   * Take the modal placement whatever the room. See {@link MdyOverlayGeometry.forceModal}.
   *
   * Presentation only: it decides where the popup goes, never what the field commits.
   */
  readonly forceModal?: boolean;
  /**
   * The decision this overlay is already holding, if it is open. Passing it keeps the popup's side
   * and height steady while its anchor moves; omitting it decides afresh, which is what opening is.
   */
  readonly current?: MdyOverlayDecision | null;
  /**
   * Keep this side and edge, but measure the height again — so the popup shrinks and scrolls as
   * its room narrows, rather than moving.
   *
   * **This is the exception, not the policy.** `current` is what an open overlay passes: the shape
   * is held and the side is re-decided only once it has stopped fitting. `lock` trades a popup that
   * moves for one that quietly loses content off the bottom, which is why no adapter uses it — it
   * remains for a host that genuinely wants a popup pinned to its corner, and the difference
   * between the two is asserted in the anchoring suite rather than left to be discovered.
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
    scrolls: MDY_WIDGET_CONTRACTS[kind].capabilities.overlayScrolls,
    ...(anchoring.minWidth !== undefined ? { minWidth: anchoring.minWidth } : {}),
    ...(anchoring.alignment !== undefined ? { alignment: anchoring.alignment } : {}),
  };
}

/**
 * The class a popup wears to say which side it ended up on, or `null` for the ordinary case.
 *
 * The catalog declares `above` and `overlay` as states of every popup part; this is the one place
 * that turns a placement into the class for them. Three renderers each deriving it from
 * `partClasses` is three chances to derive it differently — which is precisely how
 * `mdy-overlay-panel--above`, a name no stylesheet has ever matched, came to exist in two adapters
 * at once while the catalog already had a name for it.
 *
 * `below` is the ordinary case and has no class, so a popup sitting under its anchor is spelled
 * exactly like a popup nobody has placed yet.
 */
export function popupPlacementClass(kind: MdyPopupWidgetKind, placement: MdyOverlayPlacement): string | null {
  if (placement !== "above" && placement !== "overlay") return null;
  return popupStateClass(kind, placement);
}

/**
 * The class a popup wears to say which edge it hangs from, or `null` for the ordinary case.
 *
 * The other half of the same decision. `left` is the ordinary case and carries no class, exactly as
 * `below` does for placement.
 *
 * This existed in the catalog — every popup declares `right` alongside `above` and `overlay` — and
 * had no derivation, so the adapters each invented `mdy-overlay-panel--right`, a name no stylesheet
 * has ever matched, while the contract's own spelling went unemitted and dropped out of the style
 * audit as a stale entry. That is the same failure {@link popupPlacementClass} was written to end for
 * `--above`, in the one case it did not cover.
 */
export function popupAlignmentClass(kind: MdyPopupWidgetKind, alignment: MdyOverlayAlignment): string | null {
  return alignment === "right" ? popupStateClass(kind, "right") : null;
}

/**
 * The popup's own class for one of its declared states, derived rather than spelled.
 *
 * The answer is what the state *added*, not the first class shaped like a modifier of the base. A
 * popup may already carry one statically: the range picker's is
 * `["mdy-datepicker__popup", "mdy-popup", "mdy-datepicker__popup--range"]`, and matching by shape
 * returned `--range` — a variant marker — for every placement it was ever asked about, so a range
 * calendar opening above reported a class that says nothing about where it is.
 */
function popupStateClass(kind: MdyPopupWidgetKind, state: "above" | "overlay" | "right"): string | null {
  const plain = new Set(partClasses(kind, "popup"));
  const applied = partClasses(kind, "popup", { [state]: true });
  return applied.find((name) => !plain.has(name)) ?? null;
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
    scrolls: options.scrolls ?? true,
    minWidth: options.minWidth ?? 160,
    preferred: options.preferred ?? ("below" as const),
    ...(options.forceModal === undefined ? {} : { forceModal: options.forceModal }),
    ...(options.pointerX !== undefined ? { pointerX: options.pointerX } : {}),
    // The popup needs its own height *plus* the gap it must leave: the space it is given is the
    // room minus that gap, so comparing the bare content height would call a squeeze a fit.
    ...(options.contentHeight !== undefined ? { desiredHeight: options.contentHeight + gap } : {}),
    ...(options.contentWidth !== undefined ? { desiredWidth: options.contentWidth } : {}),
    ...(options.alignment !== undefined
      ? {
          preferredAlignment:
            options.direction === "rtl"
              ? (options.alignment === "right" ? ("left" as const) : ("right" as const))
              : options.alignment,
        }
      : {}),
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
    // 70% of the viewport leaves the page visible around a modal, which is right for content that
    // scrolls: a long list is meant to be clamped and the framing is what says "this is over the
    // page". Content that does not scroll has no use for the framing — clamping it produces the
    // scrollable stub the promotion to modal exists to avoid, one step further in. It gets the
    // viewport less the margin it must not touch.
    properties[prop.maxHeight] = px(
      geometry.scrolls === false
        ? Math.max(0, viewport.height - margin * 2)
        : Math.round(viewport.height * 0.7),
    );
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
