/**
 * A DOM for React's renderer, which asks for more of one than a hand-written renderer does.
 *
 * The adapters that build elements themselves need five globals and never ask what an element *is*.
 * A framework runtime does: it runs `instanceof` against the container and the nodes it patches, and
 * an `instanceof` needs the constructor to be a global rather than a property of a window nobody
 * handed it. This is the same list Vue's bench arrived at, for the same reason.
 *
 * **Its own, deliberately.** Borrowing another package's harness would tie this one's fate to a bench
 * calibrated for a different runtime, and the coupling would stay invisible until the day that bench
 * changed for its own reasons.
 */
import { JSDOM } from "jsdom";

/** What a framework runtime touches before it will draw anything. */
const RUNTIME_GLOBALS = Object.freeze([
  "Element", "SVGElement", "Node", "Text", "Comment",
  "DocumentFragment", "MutationObserver", "CSSStyleDeclaration",
  "HTMLElement", "HTMLInputElement", "Event", "KeyboardEvent", "MouseEvent", "PointerEvent",
]);

export function installDomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.navigator ??= dom.window.navigator;
  for (const name of RUNTIME_GLOBALS) {
    if (dom.window[name] !== undefined) globalThis[name] = dom.window[name];
  }
  // React schedules work through these; without them it falls back to a timer path that never
  // settles in a test that measures one frame.
  globalThis.requestAnimationFrame ??= (fn) => setTimeout(() => fn(Date.now()), 0);
  globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
  // Said explicitly, and said `false` on purpose: these benches drive the real DOM and wait for a
  // frame, rather than driving React's own test scheduler. Claiming an `act` environment asks React
  // to demand `act(...)` around every update and buries whatever the test was reporting under that
  // warning; saying nothing at all produces the same noise from the other side.
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}
