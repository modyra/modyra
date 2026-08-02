/**
 * Where a widget put its overlay, when it did not put it inside itself.
 *
 * A portalled popup is the one part legitimately outside its field's root, so it cannot be found by
 * containment. Two wrong ways to look for it, both of which have shipped in this repo:
 *
 * - **By class, across the document.** Returns whichever field rendered first, so a page with two
 *   selects reports one of them twice and the other never.
 * - **By the id the opener names, and no further.** A trigger names the *listbox*; the popup that
 *   holds it is that element's ancestor. Scoping the search to the named element finds no popup,
 *   reports it absent, and then reads `aria-expanded="true"` beside a missing popup as an incoherent
 *   state — a violation reported against a widget that was behaving correctly.
 *
 * The right way is the relationship the widget itself declared, followed all the way out: take the
 * element the opener's `aria-controls` names, then walk up to the outermost ancestor that is still
 * outside the field. That is the portalled tree, and every part inside it belongs to this widget.
 */

/**
 * The portalled subtree belonging to `widgetRoot`, or `null` when the widget keeps its overlay
 * inside itself — which is equally conforming, and the reason this returns `null` rather than
 * throwing.
 */
export function portalRootFor(widgetRoot: Element): Element | null {
  const document_ = widgetRoot.ownerDocument;
  if (!document_) return null;

  for (const opener of Array.from(widgetRoot.querySelectorAll("[aria-controls]"))) {
    const id = opener.getAttribute("aria-controls");
    if (!id) continue;
    const named = document_.getElementById(id);
    if (!named || widgetRoot.contains(named)) continue;

    let outermost: Element = named;
    for (
      let cursor = named.parentElement;
      cursor && cursor !== document_.body && !widgetRoot.contains(cursor);
      cursor = cursor.parentElement
    ) {
      outermost = cursor;
    }
    return outermost;
  }
  return null;
}
