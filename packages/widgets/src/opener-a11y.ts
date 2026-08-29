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

/**
 * Whether focus is still inside a field, given where it went.
 *
 * A field's focus has left when it has left the control **and** is not inside the panel the control
 * opened. Where that panel lives in the document is a rendering decision — taken for clipping
 * reasons, so a list is not cut off by a scrolling ancestor — and a rendering decision must not
 * reach behaviour. A renderer that answers by containment says focus left the moment it entered a
 * panel drawn elsewhere; a renderer that draws its panel in place says it did not. Same contract,
 * two behaviours, decided by where a `<div>` was appended.
 *
 * So the scope follows the link the opener declares: `aria-controls` names the element, and that
 * element and everything inside it belongs to the field wherever it is drawn. ADR 0167.
 *
 * `null` — focus went nowhere at all — is not a leaving here and is deliberately the caller's
 * question: re-rendering an element removes whatever was focused and blurs it into nowhere, and a
 * calendar cell replaced when the view changes must not read as somebody walking out of the field.
 */
export function focusIsInsideField(root: Element, node: Node | null): boolean {
  if (node === null) return false;
  if (root.contains(node)) return true;
  const owner = root.ownerDocument;
  if (owner === null) return false;
  // Every opener in the field, not only the first: a kind may draw more than one control over the
  // same panel — a typeable box and the button beside it — and asking only one of them makes the
  // panel foreign the moment the other is what opened it.
  // `Array.from` rather than a spread: the two compilers this package is built with disagree
  // about whether a `NodeListOf` is iterable, and only one of them says so.
  for (const opener of Array.from(root.querySelectorAll("[aria-controls]"))) {
    for (const id of (opener.getAttribute("aria-controls") ?? "").split(/\s+/)) {
      if (id === "") continue;
      const controlled = owner.getElementById(id);
      if (controlled !== null && (controlled === node || controlled.contains(node))) return true;
    }
  }
  return false;
}
