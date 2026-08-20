/**
 * The relation between an overlay's opener and the overlay it opens.
 *
 * A function of kind, widget id and open-ness alone — no controller, no widget state — so a renderer
 * can bind it without building the machinery that produces the rest of a kind's projection. The
 * kind-specific projections call it too, which is what keeps one answer to a relation that appears
 * on six kinds and three adapters.
 */
import { MDY_POPUP_OPENERS, type MdyWidgetKind } from "./catalog.js";
import type { MdyPartContract } from "./contract.js";
import { defaultWidgetIdFactory as idFactory } from "./ids.js";

export interface MdyOverlayOpenerA11yOptions {
  readonly widgetId: string;
  /** Whether the overlay is showing. */
  readonly open: boolean;
  /**
   * Whether the element the opener controls is in the document.
   *
   * Not the same question as `open`: a renderer that builds its popup eagerly keeps it mounted and
   * hidden while closed, and one that builds it on demand has nothing to point at until it does.
   * `aria-controls` naming an id that resolves to nothing is a dangling reference, which assistive
   * technology cannot follow and which no amount of correct `aria-expanded` makes up for.
   *
   * Defaults to true — an eagerly-mounted popup, which is what every caller assumed before this
   * existed.
   */
  readonly controlsRendered?: boolean;
}

/**
 * The attributes an overlay's opener carries, or `null` for a kind with no overlay.
 *
 * `aria-expanded` is a string in both states rather than an attribute that comes and goes: it is a
 * property of the opener, and an opener that drops it while closed reads as a control with no
 * overlay at all.
 */
export function projectOverlayOpenerA11y(
  kind: MdyWidgetKind,
  options: MdyOverlayOpenerA11yOptions,
): MdyPartContract | null {
  const relation = MDY_POPUP_OPENERS[kind];
  if (!relation) return null;
  return {
    classes: [],
    ...(relation.role ? { role: relation.role } : {}),
    attributes: {
      // The promise, from the same table that names what the opener controls. Written as a literal
      // at each opener instead, it was five literals across two renderers, and two of them said
      // different words about one widget — `aria-haspopup` is announced with the control, so a
      // person acts on it before anything has opened.
      ...(relation.promises ? { "aria-haspopup": relation.promises } : {}),
      // A property of the opener in both states: an opener that drops it while closed reads as a
      // control with no overlay at all.
      "aria-expanded": String(options.open),
      // Emitted only while there is something to name.
      "aria-controls": (options.controlsRendered ?? true)
        ? idFactory.part(options.widgetId, relation.controls)
        : null,
    },
  };
}

/** The id the opener names, for a renderer that has to put it on the controlled element. */
export function overlayControlledId(kind: MdyWidgetKind, widgetId: string): string | null {
  const relation = MDY_POPUP_OPENERS[kind];
  return relation ? idFactory.part(widgetId, relation.controls) : null;
}
