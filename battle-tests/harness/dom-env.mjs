/**
 * A real document for the battles that need one.
 *
 * Accessibility claims are about relationships between elements — a control naming the listbox it
 * opens, an error naming the field it belongs to — and a relationship is only observable in a
 * document that actually resolves ids. A string-assignment fake would answer every question with
 * whatever the renderer wrote, which is the thing under test.
 *
 * `jsdom` is a test tool rather than a package under attack, so importing it is not a reach past a
 * package entry point: the renderers themselves are still consumed through their published entries.
 */

import { JSDOM } from "jsdom";

/**
 * The globals a renderer reaches for without being handed them.
 *
 * A custom-element renderer reads constructors off the global scope at module-evaluation time —
 * `Document.prototype`, `CSSStyleSheet`, `customElements` — long before any test calls it, so
 * installing only `document` and `window` fails at import rather than at render. The list is named
 * rather than copied wholesale from `window`: overwriting every global a document happens to carry
 * would replace things the test runner itself is using.
 */
const RENDERER_GLOBALS = Object.freeze([
  "window",
  "document",
  "customElements",
  "Document",
  "DocumentFragment",
  "Element",
  "HTMLElement",
  "Node",
  "ShadowRoot",
  "CSSStyleSheet",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "MutationObserver",
  "ResizeObserver",
  "IntersectionObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "matchMedia",
  "navigator",
]);

/**
 * Install a document as globals and hand back the teardown.
 *
 * The globals are restored rather than left in place: two battles in one process would otherwise
 * share a document, and an id that survived the first would read as a collision in the second.
 */
export function installDocument() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  const previous = {};
  for (const name of RENDERER_GLOBALS) previous[name] = globalThis[name];

  for (const name of RENDERER_GLOBALS) {
    const value = name === "window" ? dom.window : dom.window[name];
    if (value === undefined) continue;
    // `navigator` and friends are getter-only on the global in some Node versions; defining the
    // property is what works for both those and the plain writable ones.
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }

  return {
    document: dom.window.document,
    host() {
      const element = dom.window.document.createElement("div");
      dom.window.document.body.append(element);
      return element;
    },
    restore() {
      // Closing the window empties the document, which runs `disconnectedCallback` on every custom
      // element still in it — and those read `document` off the global scope. Restoring first takes
      // the document away mid-teardown and the renderer raises inside its own cleanup, which reads
      // as a defect in whatever battle happened to run last.
      dom.window.close();
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[name];
        else Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
      }
    },
  };
}

/**
 * Every attribute whose value is one or more ids of other elements.
 *
 * `aria-controls` is the one the claim names, but it is not alone: a relationship that dangles is
 * the same defect whichever attribute carries it, and a renderer that gets one right and another
 * wrong would be reported as clean by a check that only reads the named one.
 */
export const ID_REFERENCE_ATTRIBUTES = Object.freeze([
  "aria-controls",
  "aria-labelledby",
  "aria-describedby",
  "aria-activedescendant",
  "aria-errormessage",
  "aria-owns",
  "aria-details",
  "for",
]);

/**
 * Every id reference in `root` that does not resolve to an element in `document`.
 *
 * The reference is reported with the attribute and the element that carried it, because "an id is
 * missing" is not actionable and "this control's aria-controls names a listbox that is gone" is.
 */
export function danglingReferences(root, document) {
  const dangling = [];
  for (const element of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of ID_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      // A token list: `aria-labelledby` may name several elements, and one of them may be gone.
      for (const id of value.split(/\s+/).filter(Boolean)) {
        if (document.getElementById(id) === null) {
          dangling.push({
            from: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`,
            attribute,
            missing: id,
          });
        }
      }
    }
  }
  return dangling;
}
