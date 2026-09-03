/**
 * A DOM for a framework runtime, which needs more of one than a renderer that writes it by hand.
 *
 * The other adapters install five globals — `window`, `document`, `HTMLElement`, `Event`,
 * `KeyboardEvent` — and that is enough for them because they build elements themselves and never ask
 * what an element *is*. Vue's runtime does ask: before it will mount anything it runs `instanceof`
 * against the container and against the nodes it patches, and an `instanceof` needs the constructor
 * to be a global, not a property of a window nobody passed it.
 *
 * So the list below is not a convenience: each name is one `runtime-dom` reaches for, found by
 * mounting a component and reading what it complained about, one refusal at a time. The first was
 * `SVGElement is not defined` — from a check that decides whether the container is an SVG root, on a
 * page with no SVG in it at all.
 *
 * **Its own, deliberately.** Borrowing another package's test support would tie this one's fate to a
 * harness calibrated for a renderer that never does `instanceof`, and the coupling would be invisible
 * until the day that harness changed for its own reasons.
 */
import { JSDOM } from "jsdom";

/**
 * What a framework runtime touches before it will draw anything.
 *
 * `Element` and `SVGElement` decide what the mount container is. `Node`, `Text` and `Comment` are
 * what a virtual node is patched into — a comment is how a framework marks an absent branch, so a
 * runtime that cannot construct one cannot render a conditional. `DocumentFragment` is how a subtree
 * arrives in one insertion. `MutationObserver` and `CSSStyleDeclaration` are reached by the parts
 * that watch and style, and are installed here rather than waited for: a global missing only on the
 * path a later test takes is a failure that looks like the feature's fault.
 */
const RUNTIME_GLOBALS = Object.freeze([
  "Element", "SVGElement", "Node", "Text", "Comment",
  "DocumentFragment", "MutationObserver", "CSSStyleDeclaration",
]);

export function installDomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  for (const name of RUNTIME_GLOBALS) {
    // Taken from this window rather than assumed present: a name jsdom stops providing should fail
    // here, where the list is, instead of inside a runtime that will only say it is not defined.
    const value = dom.window[name];
    if (value === undefined) throw new Error(`this jsdom provides no ${name}, which a framework runtime needs before it will mount`);
    globalThis[name] = value;
  }
  return dom;
}

/** The names this harness installs beyond the five a hand-written renderer needs. */
export const runtimeGlobals = RUNTIME_GLOBALS;
