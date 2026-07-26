/**
 * Real jsdom globals for the Studio shell tests.
 *
 * The previous `createFakeHost()` only modelled `innerHTML` string assignment,
 * which stopped being enough once the shell became persistent: whether a region
 * is *rewritten* or *left alone* (and therefore whether scroll, listeners and
 * the live form survive) is only observable against a DOM.
 */
import { JSDOM } from "jsdom";

export function installDomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.Option = dom.window.Option;
  globalThis.confirm ??= () => true;
  return dom;
}

/** A mounted-into host element attached to the jsdom document. */
export function createHost() {
  const host = document.createElement("div");
  document.body.append(host);
  return host;
}
