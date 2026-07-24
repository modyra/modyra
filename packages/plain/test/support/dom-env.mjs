/**
 * Installs a real jsdom `window`/`document` as globals for one test file —
 * this package's whole job is DOM manipulation (createElement/
 * addEventListener/attribute reads), so a real DOM implementation is the
 * honest way to test it; the studio-ui `createFakeHost()` pattern only
 * covers `innerHTML` string assignment, not real element creation/events.
 */
import { JSDOM } from "jsdom";

export function installDomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  return dom;
}
