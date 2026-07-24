/**
 * Small, framework-free DOM helpers shared by every field renderer. No
 * virtual DOM, no diffing library: each renderer creates its real elements
 * once and these helpers patch attributes/classes/text on the *same*
 * elements every time a controller's reactive state changes, so focus and
 * caret position survive a re-render (rebuilding an <input> on every
 * keystroke would steal focus from the user typing into it).
 */
import type { MdyPartContract } from "@modyra/widgets";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

const BASE_CLASS_MARKER = "__mdyPlainBaseClasses";

/** Applies an {@link MdyPartContract} (classes + attributes) to a real element, replacing only what the contract controls each call. */
export function applyPart(node: HTMLElement, part: MdyPartContract): void {
  const nodeWithMarker = node as HTMLElement & { [BASE_CLASS_MARKER]?: string };
  // Preserve any class the host/renderer set once at creation time (e.g. "mdy-plain-input")
  // that isn't part of the controller-driven class list, so re-applying doesn't drop it.
  if (nodeWithMarker[BASE_CLASS_MARKER] === undefined) {
    nodeWithMarker[BASE_CLASS_MARKER] = node.className;
  }
  const base = nodeWithMarker[BASE_CLASS_MARKER];
  node.className = [base, ...part.classes].filter(Boolean).join(" ");

  if (part.id) node.id = part.id;
  if (part.role) node.setAttribute("role", part.role);

  for (const [key, value] of Object.entries(part.attributes)) {
    if (value === null || value === undefined || value === false) {
      node.removeAttribute(key);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
}

/** Sets text content only when it actually changed, to avoid unnecessary reflow/selection loss. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setErrors(container: HTMLElement, messages: ReadonlyArray<string>): void {
  container.replaceChildren();
  for (const message of messages) {
    const li = el("li");
    setText(li, message);
    container.appendChild(li);
  }
}
