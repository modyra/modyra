/**
 * What an overlay's opener promises will appear, taken from the contract.
 *
 * `aria-haspopup` is announced *with* the control, before anything opens, and a person decides
 * whether to open it from that word — so a renderer that writes the word itself is a renderer that
 * can disagree with the contract, and with the other renderers, about what a widget is. Nineteen
 * places across three adapters wrote it as a literal, and two of them said different words about one
 * kind.
 *
 * A one-line helper rather than the literal at each opener: the value belongs to
 * `MDY_POPUP_OPENERS`, and a call is what makes the dependency visible to anything that looks.
 */
import { projectOverlayOpenerA11y, type MdyWidgetKind } from "@modyra/widgets";

export function applyOpenerPromise(opener: Element, kind: MdyWidgetKind): void {
  const promised = projectOverlayOpenerA11y(kind, { open: false, widgetId: "", controlsRendered: false })
    ?.attributes["aria-haspopup"];
  if (typeof promised === "string") opener.setAttribute("aria-haspopup", promised);
}
