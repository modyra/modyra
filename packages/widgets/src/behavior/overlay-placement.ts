/**
 * Where an overlay goes, and whether it stays there.
 *
 * Pure geometry: a rectangle, a viewport and a margin decide a side and an alignment. Nothing here
 * touches the document — `overlay-dom.ts` does that, and `overlay.ts` turns a decision into styles.
 * The three used to be one file's worth of concern split across three, with the two constants that
 * govern them in two different ones.
 */
export const MDY_OVERLAY_VIEWPORT_MARGIN = 12;

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
  if (desired !== undefined && roomOn(input.preferred) >= desired) {
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
