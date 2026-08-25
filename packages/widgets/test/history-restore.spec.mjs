/**
 * Adopting what the browser gave back, against the rule directly.
 *
 * The load-bearing case is the negative one: a control the renderer itself wrote to between the
 * snapshot and the comparison must not be reported to the model as a person's input. Every value in
 * a form moves at some point; what distinguishes a restore is that nothing in this library moved it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { adoptHistoryRestore } from "../dist/index.js";

/** @typedef {import("../dist/index.js").MdyHistoryRestoreBinding} MdyHistoryRestoreBinding */

const page = () => {
  const dom = new JSDOM("<div id='root'><input id='a' value='Ada'><input id='b' value='Alan'><textarea id='c'>prima</textarea><input id='d' type='checkbox'></div>");
  return dom.window.document;
};

/** A scheduler the test drives, standing in for the task the comparison defers to. */
const manual = () => {
  const queue = [];
  return { schedule: (run) => queue.push(run), flush: () => { for (const run of queue.splice(0)) run(); } };
};

/** What each control was told, in order, so a spec can assert on who heard what. */
const listen = (document) => {
  const heard = [];
  for (const type of ["input", "change"]) {
    document.addEventListener(type, (event) => { heard.push(`${event.target.id}:${type}`); }, true);
  }
  return heard;
};

const backForward = () => "back_forward";

test("a control the browser restored is reported to the model", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  /** @type {MdyHistoryRestoreBinding} */
  const binding = { root: document.getElementById("root"), schedule: clock.schedule, navigation: backForward };
  adoptHistoryRestore(binding);

  // The browser writing the value back, which is all a restore is: no event, just a new value.
  document.getElementById("a").value = "Grace";
  clock.flush();

  assert.deepEqual(heard, ["a:input", "a:change"]);
});

test("a control nothing touched is left alone", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptHistoryRestore({ root: document.getElementById("root"), schedule: clock.schedule, navigation: backForward });
  clock.flush();

  assert.deepEqual(heard, [], "every field would be marked touched by a form nobody had typed in");
});

test("an ordinary navigation adopts nothing at all", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptHistoryRestore({ root: document.getElementById("root"), schedule: clock.schedule, navigation: () => "navigate" });
  document.getElementById("a").value = "Grace";
  clock.flush();

  assert.deepEqual(heard, [], "outside a history traversal a changed value is the renderer's own work");
});

test("a checkbox and a textarea are restored like anything else", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptHistoryRestore({ root: document.getElementById("root"), schedule: clock.schedule, navigation: backForward });
  document.getElementById("c").value = "dopo";
  document.getElementById("d").checked = true;
  clock.flush();

  assert.deepEqual(heard, ["c:input", "c:change", "d:input", "d:change"]);
});

test("a control removed before the comparison is not spoken to", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptHistoryRestore({ root: document.getElementById("root"), schedule: clock.schedule, navigation: backForward });
  const b = document.getElementById("b");
  b.value = "Turing";
  b.remove();
  clock.flush();

  assert.deepEqual(heard, []);
});

test("cancelling before the comparison stops it", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  const cancel = adoptHistoryRestore({ root: document.getElementById("root"), schedule: clock.schedule, navigation: backForward });
  document.getElementById("a").value = "Grace";
  cancel();
  clock.flush();

  assert.deepEqual(heard, [], "a form torn down between the two halves must not write to a model that is gone");
});

test("only the controls that moved are adopted, and the others stay silent", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptHistoryRestore({ root: document.getElementById("root"), schedule: clock.schedule, navigation: backForward });
  document.getElementById("a").value = "Grace";
  clock.flush();

  assert.equal(heard.filter((h) => h.startsWith("b:")).length, 0);
  assert.equal(heard.filter((h) => h.startsWith("a:")).length, 2);
});
