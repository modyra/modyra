/**
 * Applying a part contract to a real element.
 *
 * A projection decides what a control exposes — classes, id, role, ARIA state — and this writes that
 * decision to the DOM. Consuming the whole contract is what keeps every renderer of a kind
 * semantically identical: an attribute added to a projection reaches the DOM without any renderer
 * being edited, and no renderer can expose a different subset of a widget's states.
 */
import type { MdyPartContract } from "./contract.js";

const BASE_CLASS_MARKER = "__mdyPartBaseClasses";

/**
 * Applies an {@link MdyPartContract} — classes, styles, id, role, attributes — to an element,
 * replacing only what the contract controls on each call.
 *
 * Safe to re-run on every state change: it patches the same element rather than replacing it, so
 * focus and caret position survive.
 *
 * Classes set on the element at creation time are preserved. The first call records them, and every
 * later call rebuilds `class` from that baseline plus the contract's own — otherwise re-applying a
 * part would drop structural classes the contract does not know about.
 */
export function applyPart(node: HTMLElement, part: MdyPartContract): void {
  const nodeWithMarker = node as HTMLElement & { [BASE_CLASS_MARKER]?: string };
  if (nodeWithMarker[BASE_CLASS_MARKER] === undefined) {
    nodeWithMarker[BASE_CLASS_MARKER] = node.className;
  }
  const base = nodeWithMarker[BASE_CLASS_MARKER];
  // The baseline may already carry the canonical class the contract names, so dedupe rather than
  // stack `mdy-label mdy-label`.
  const classes = [...new Set([...(base ?? "").split(/\s+/), ...part.classes].filter(Boolean))];
  if (classes.length > 0) node.className = classes.join(" ");
  else node.removeAttribute("class");

  for (const [property, value] of Object.entries(part.style ?? {})) {
    node.style.setProperty(property, value);
  }

  if (part.id) node.id = part.id;
  if (part.role) node.setAttribute("role", part.role);

  for (const [key, value] of Object.entries(part.attributes)) {
    // `false` removes the attribute, which is what HTML boolean attributes want (`disabled`) and
    // never what ARIA state attributes want: `aria-checked="false"` is a state, and dropping it
    // leaves a `role="switch"` missing a required attribute. Projections therefore emit ARIA states
    // as the strings "true"/"false", and only genuine boolean attributes as booleans.
    if (value === null || value === undefined || value === false) {
      node.removeAttribute(key);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
}
