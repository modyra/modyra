/**
 * The reset a `<form>` performs, against what the binding promises.
 *
 * The rule this pins is not "a listener was added" — it is **when** the model is written. The
 * browser resets its own controls *after* dispatching the event, so a model written during the
 * event is overwritten by the boxes a moment later, and a test that asserts synchronously would
 * pass on exactly the implementation that fails in a page. Every assertion here therefore runs the
 * scheduled work explicitly, and one of them asserts that nothing has happened before it does.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { bindFormReset } from "../dist/index.js";

/** @typedef {import("../dist/index.js").MdyFormResetBinding} MdyFormResetBinding */

const page = () => {
  const dom = new JSDOM("<form id='f'><input id='in' /></form><div id='loose'></div>");
  return dom.window.document;
};

/** A scheduler the test drives, standing in for the task the binding defers to. */
const manual = () => {
  const queue = [];
  return { schedule: (run) => queue.push(run), flush: () => { for (const run of queue.splice(0)) run(); }, get pending() { return queue.length; } };
};

test("a reset writes the model, and only after the browser has finished", () => {
  const document = page();
  const clock = manual();
  let resets = 0;

  /** @type {MdyFormResetBinding} */
  const binding = { element: document.getElementById("in"), reset: () => { resets += 1; }, schedule: clock.schedule };
  bindFormReset(binding);

  document.getElementById("f").dispatchEvent(new document.defaultView.Event("reset"));
  assert.equal(resets, 0, "written during the event, the browser's own reset would overwrite it");
  assert.equal(clock.pending, 1);

  clock.flush();
  assert.equal(resets, 1);
});

test("unbinding stops it, and a second reset is not answered", () => {
  const document = page();
  const clock = manual();
  let resets = 0;

  const unbind = bindFormReset({ element: document.getElementById("in"), reset: () => { resets += 1; }, schedule: clock.schedule });
  unbind();

  document.getElementById("f").dispatchEvent(new document.defaultView.Event("reset"));
  clock.flush();
  assert.equal(resets, 0);
});

test("an element outside any form binds nothing and unbinds safely", () => {
  const document = page();
  let resets = 0;

  const unbind = bindFormReset({ element: document.getElementById("loose"), reset: () => { resets += 1; } });
  document.getElementById("f").dispatchEvent(new document.defaultView.Event("reset"));
  assert.equal(resets, 0, "a control mounted on its own has no reset to answer");
  assert.doesNotThrow(unbind);
});

test("the form itself is a legitimate element: a renderer that owns its form binds to it directly", () => {
  const document = page();
  const clock = manual();
  let resets = 0;

  // `closest` matches the element itself, which is what lets a renderer that *renders* the form
  // pass it here instead of hunting for a control inside it.
  bindFormReset({ element: document.getElementById("f"), reset: () => { resets += 1; }, schedule: clock.schedule });
  document.getElementById("f").dispatchEvent(new document.defaultView.Event("reset"));
  clock.flush();
  assert.equal(resets, 1);
});

test("a reset in another form is not answered", () => {
  const dom = new JSDOM("<form id='mine'><input id='in' /></form><form id='theirs'><input /></form>");
  const document = dom.window.document;
  const clock = manual();
  let resets = 0;

  bindFormReset({ element: document.getElementById("in"), reset: () => { resets += 1; }, schedule: clock.schedule });
  document.getElementById("theirs").dispatchEvent(new dom.window.Event("reset"));
  clock.flush();
  assert.equal(resets, 0);
});
