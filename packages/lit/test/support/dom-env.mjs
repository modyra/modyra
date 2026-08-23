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

/**
 * Renders one element, waits for Lit's update, and returns it.
 *
 * The one before it is taken off the page first. Every test here mounts a field of the same name, so
 * leaving them appended put several elements in one document claiming one set of ids — and a
 * contract check that resolves an id then reads whichever came first. The failure that follows names
 * the widget under test and is caused by the one before it, which is the worst kind to debug: it
 * appears when an unrelated kind starts publishing an id the earlier one already had.
 *
 * Pass `keep` when a test is *about* two elements coexisting.
 */
const mounted = [];

export async function mount(tag, configure, { keep = false } = {}) {
  if (!keep) {
    for (const previous of mounted.splice(0)) previous.remove();
  }
  const element = document.createElement(tag);
  configure?.(element);
  document.body.append(element);
  mounted.push(element);
  await element.updateComplete;
  return element;
}
