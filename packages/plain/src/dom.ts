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

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** Sets text content only when it actually changed, to avoid unnecessary reflow/selection loss. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setErrors(container: HTMLElement, messages: ReadonlyArray<string>): void {
  container.replaceChildren();
  for (const message of messages) {
    // `mdy-control__error` is the class the shipped themes style, same as the Lit renderers.
    const li = el("li", "mdy-control__error");
    setText(li, message);
    container.appendChild(li);
  }
}
