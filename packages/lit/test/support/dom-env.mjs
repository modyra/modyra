/**
 * Installs a real jsdom window for the custom elements this package defines.
 *
 * Lit renders into the light DOM here, so a real DOM implementation — with `customElements`, the
 * element constructors Lit subclasses, and the events its templates bind — is the only honest way
 * to assert what these elements actually render.
 */
import { JSDOM } from "jsdom";

export function installDomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  const { window } = dom;
  for (const name of [
    "window", "document", "customElements", "HTMLElement", "HTMLInputElement", "HTMLButtonElement",
    "HTMLTextAreaElement", "HTMLSelectElement", "HTMLDivElement", "HTMLSpanElement", "HTMLLabelElement",
    "Element", "Node", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "FocusEvent", "InputEvent",
    "DOMParser", "NodeFilter", "ShadowRoot", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
    // Lit's style machinery feature-detects these at module scope, before any element exists.
    "Document", "CSSStyleSheet", "CSSStyleRule", "HTMLTemplateElement", "DocumentFragment", "Text", "Comment",
  ]) {
    globalThis[name] = window[name];
  }
  return dom;
}

/** Renders one element, waits for Lit's update, and returns it. */
export async function mount(tag, configure) {
  const element = document.createElement(tag);
  configure?.(element);
  document.body.append(element);
  await element.updateComplete;
  return element;
}
