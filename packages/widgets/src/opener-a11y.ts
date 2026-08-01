/**
 * The relation between an overlay's opener and the overlay it opens.
 *
 * A function of kind, widget id and open-ness alone — no controller, no widget state — so a renderer
 * can bind it without building the machinery that produces the rest of a kind's projection. The
 * kind-specific projections call it too, which is what keeps one answer to a relation that appears
 * on six kinds and three adapters.
 */
import { MDY_POPUP_OPENERS } from "./catalog.js";
import type { MdyPartContract } from "./contract.js";
import { defaultWidgetIdFactory as idFactory } from "./ids.js";

export interface MdyOverlayOpenerA11yOptions {
  readonly widgetId: string;
  /** Whether the overlay is showing. */
  readonly open: boolean;
}

/**
 * The attributes an overlay's opener carries, or `null` for a kind with no overlay.
 *
 * `aria-expanded` is a string in both states rather than an attribute that comes and goes: it is a
 * property of the opener, and an opener that drops it while closed reads as a control with no
 * overlay at all.
 */
export function projectOverlayOpenerA11y(
  kind: string,
  options: MdyOverlayOpenerA11yOptions,
): MdyPartContract | null {
  const relation = MDY_POPUP_OPENERS[kind];
  if (!relation) return null;
  return {
    classes: [],
    attributes: {
      "aria-expanded": String(options.open),
      "aria-controls": idFactory.part(options.widgetId, relation.controls),
    },
  };
}

/** The id the opener names, for a renderer that has to put it on the controlled element. */
export function overlayControlledId(kind: string, widgetId: string): string | null {
  const relation = MDY_POPUP_OPENERS[kind];
  return relation ? idFactory.part(widgetId, relation.controls) : null;
}
