/**
 * The inspector mounts because somebody asked, and the bundler only decides when nobody did.
 *
 * `mountMdyDevtools` appeared in four of the starters, and a line every starter carries is a line
 * that reads as part of the minimum a form needs. It is not: it is a development tool, and the
 * question of whether to mount one has an answer the caller may hold.
 *
 * `true` and `false` are answers; `undefined` is the absence of one. The distinction is the whole
 * of it — a heuristic that cannot be overridden is a guess a consumer cannot correct, and an option
 * with no default is the line that ends up in every starter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createForm, field } from "../dist/index.js";
import { devtoolsWanted, mountMdyDevtoolsIfWanted } from "../dist/devtools.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

test("an explicit answer wins in both directions", () => {
  assert.equal(devtoolsWanted(false, true), false, "a development build could not be told no");
  assert.equal(devtoolsWanted(true, false), true, "a production build could not be told yes");
});

test("no answer is where the build decides", () => {
  assert.equal(devtoolsWanted(undefined, true), true);
  assert.equal(devtoolsWanted(undefined, false), false);
});

test("what was asked for is mounted, and what was not is not", () => {
  const form = createForm({ a: field("") });
  const host = document.createElement("div");
  document.body.append(host);

  const nothing = mountMdyDevtoolsIfWanted(form, host, false);
  assert.equal(host.children.length, 0, "the inspector mounted where it was refused");
  assert.equal(typeof nothing, "function", "a disposer is owed whether or not anything mounted");
  nothing();

  const dispose = mountMdyDevtoolsIfWanted(form, host, true);
  assert.ok(host.children.length > 0, "the inspector did not mount where it was asked for");
  dispose();
});

test("a missing host is not an error, and still returns a disposer", () => {
  // A starter that asks for the inspector on a page without its element should get nothing, not a
  // crash: the panel is a convenience, and a convenience that can break the form is not one.
  const form = createForm({ a: field("") });
  const dispose = mountMdyDevtoolsIfWanted(form, null, true);
  assert.equal(typeof dispose, "function");
  dispose();
});
