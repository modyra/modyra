/**
 * Small, framework-free DOM helpers shared by every field renderer. No
 * virtual DOM, no diffing library: each renderer creates its real elements
 * once and these helpers patch attributes/classes/text on the *same*
 * elements every time a controller's reactive state changes, so focus and
 * caret position survive a re-render (rebuilding an <input> on every
 * keystroke would steal focus from the user typing into it).
 */
// `applyPart` now lives in `@modyra/widgets` and is re-exported here so Plain's eighty-six call
// sites keep their import. It was always framework-agnostic; keeping it in Plain is what let the
// other two adapters drift, because only Plain was applying the projection's whole attribute map.
export { applyPart } from "@modyra/widgets";
import { MDY_ICONS, type MdyIconName } from "@modyra/widgets";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * The icon a name stands for, as real SVG geometry.
 *
 * Icons are geometry, never a character. A pictographic character renders in the reader's emoji
 * font, at that font's size and baseline, in colours the theme does not choose and cannot restyle —
 * so it matches nothing around it and changes shape between platforms.
 *
 * The geometry is `MDY_ICONS`, shared with every other renderer, so a clock drawn here and a clock
 * drawn by another adapter are the same clock.
 */
export function mdyIcon(name: MdyIconName, className?: string): SVGSVGElement {
  const icon = MDY_ICONS[name];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", icon.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);
  // The registry holds markup, and it is the package's own constant rather than anything a caller
  // supplies — there is no untrusted string on this path.
  svg.innerHTML = icon.content;
  return svg;
}

/** Replaces a node's contents with one icon, leaving the node itself alone. */
export function setIcon(node: HTMLElement, name: MdyIconName, className?: string): void {
  node.replaceChildren(mdyIcon(name, className));
}

/** Sets text content only when it actually changed, to avoid unnecessary reflow/selection loss. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setErrors(container: HTMLElement, messages: ReadonlyArray<string>): void {
  container.replaceChildren();
  // An empty list occupies no room. Reserved height stops a form jumping when a message appears —
  // a defensible choice, and one this renderer was making alone: 24 empty pixels under every field
  // where the other two had none, which is a form that lays out differently per adapter.
  container.hidden = messages.length === 0;
  for (const message of messages) {
    // `mdy-control__error` is the class the shipped themes style, whichever renderer emits itrers.
    const li = el("li", "mdy-control__error");
    setText(li, message);
    container.appendChild(li);
  }
}

/**
 * A part that is on the page under a condition, and off it otherwise.
 *
 * `hidden` is not the same claim. The contract says a part is *present when* its condition holds,
 * and a checker reading the anatomy finds a hidden element and sees a part drawn while its condition
 * is false — which is what two of the three renderers avoid by building the element only when it is
 * owed. An element kept and hidden also stays in `textContent`, so anything deriving words from the
 * control reads a placeholder that is not on screen.
 *
 * `before` fixes where it goes back: the contract's part order is the reading order, and an element
 * re-appended after a removal would join the end of its parent instead.
 */
export function setPresent(node: HTMLElement, parent: HTMLElement, before: Node | null, present: boolean): void {
  if (!present) {
    node.remove();
    return;
  }
  if (node.parentElement === parent) return;
  parent.insertBefore(node, before);
}
