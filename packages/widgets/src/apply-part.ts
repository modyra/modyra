/**
 * Applying a part contract to a real element.
 *
 * A projection decides what a control exposes — classes, id, role, ARIA state — and this writes that
 * decision to the DOM. Consuming the whole contract is what keeps every renderer of a kind
 * semantically identical: an attribute added to a projection reaches the DOM without any renderer
 * being edited, and no renderer can expose a different subset of a widget's states.
 */
import type { MdyPartContract } from "./contract.js";

/** The classes this applier put on an element last time, so it can take back only its own. */
const OWNED_CLASSES = "__mdyPartClasses";

/**
 * Applies an {@link MdyPartContract} — classes, styles, id, role, attributes — to an element,
 * replacing only what the contract controls on each call.
 *
 * Safe to re-run on every state change: it patches the same element rather than replacing it, so
 * focus and caret position survive.
 *
 * Only the classes the contract names are touched. An element's classes come from more than one
 * place — written once at creation, toggled by a host binding on every change — and rewriting the
 * whole attribute would drop the ones this does not own, silently and without breaking rendering.
 * A contract naming no classes therefore leaves `class` untouched.
 */
export function applyPart(node: HTMLElement, part: MdyPartContract): void {
  const owner = node as HTMLElement & { [OWNED_CLASSES]?: readonly string[] };
  const next = part.classes.filter(Boolean);
  for (const className of owner[OWNED_CLASSES] ?? []) {
    if (!next.includes(className)) node.classList.remove(className);
  }
  for (const className of next) node.classList.add(className);
  owner[OWNED_CLASSES] = next;

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
