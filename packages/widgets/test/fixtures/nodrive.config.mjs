/** A renderer whose mount forgets `drive` — what somebody copying the reference config writes. */
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;

export const name = "forgot drive";
export const kinds = ["text"];
export const mount = () => {
  const host = document.createElement("div");
  host.append(document.createElement("input"));
  document.body.append(host);
  return { root: host, parts: () => ({}), settle: () => undefined, dispose: () => host.remove() };
};
