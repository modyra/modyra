/**
 * Values written by something other than this library, against the rule directly.
 *
 * The load-bearing cases are the negative ones. A control the renderer itself wrote to must not be
 * reported to the model as somebody else's input — every value in a form moves at some point, and
 * what distinguishes a silent write is only that nothing here heard about it. And the submit guard
 * must run *before* whatever reads the value, or it guards nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { adoptSilentWrites } from "../dist/index.js";

/** @typedef {import("../dist/index.js").MdySilentWriteBinding} MdySilentWriteBinding */

const page = () => {
  const dom = new JSDOM("<form id='f'><div id='root'><input id='a' value='Ada'><input id='b' value='Alan'><textarea id='c'>prima</textarea><input id='d' type='checkbox'></div></form><div id='altrove'><input id='e'></div>");
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
const ordinary = () => "navigate";
const root = (document) => document.getElementById("root");
const submit = (document) => document.getElementById("f").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));

// ── The restore, as the controls are built ────────────────────────────────────────────────────

test("a control the browser restored is reported to the model", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  /** @type {MdySilentWriteBinding} */
  const binding = { root: root(document), schedule: clock.schedule, navigation: backForward };
  adoptSilentWrites(binding);

  // The browser writing the value back, which is all a restore is: no event, just a new value.
  document.getElementById("a").value = "Grace";
  clock.flush();

  assert.deepEqual(heard, ["a:input", "a:change"]);
});

test("a control nothing touched is left alone", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), schedule: clock.schedule, navigation: backForward });
  clock.flush();

  assert.deepEqual(heard, [], "every field would be marked touched by a form nobody had typed in");
});

test("an ordinary navigation adopts nothing as the controls are built", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), schedule: clock.schedule, navigation: ordinary });
  document.getElementById("a").value = "Grace";
  clock.flush();

  assert.deepEqual(heard, [], "outside a history traversal a changed value is the renderer's own work");
});

test("a checkbox and a textarea are restored like anything else", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), schedule: clock.schedule, navigation: backForward });
  document.getElementById("c").value = "dopo";
  document.getElementById("d").checked = true;
  clock.flush();

  assert.deepEqual(heard, ["c:input", "c:change", "d:input", "d:change"]);
});

// ── The submit, whatever wrote in between ─────────────────────────────────────────────────────

test("a value written silently is adopted at the submit", () => {
  const document = page();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), navigation: ordinary });
  // Autofill, a password manager, an extension: a value property set, and nothing said.
  document.getElementById("a").value = "Grace";
  submit(document);

  assert.deepEqual(heard, ["a:input", "a:change"]);
});

test("the submit guard runs before anything that reads the value", () => {
  const document = page();
  const seen = [];

  adoptSilentWrites({ root: root(document), navigation: ordinary });
  document.getElementById("f").addEventListener("submit", () => {
    seen.push(document.getElementById("a").value);
  });
  document.getElementById("a").addEventListener("input", () => { seen.push("adopted"); });

  document.getElementById("a").value = "Grace";
  submit(document);

  assert.deepEqual(seen, ["adopted", "Grace"], "a handler reading the value must read the adopted one");
});

test("what arrived the ordinary way is not adopted again at the submit", () => {
  const document = page();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), navigation: ordinary });
  const a = document.getElementById("a");
  a.value = "Grace";
  a.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  heard.length = 0;

  submit(document);
  assert.deepEqual(heard, [], "a person's own typing was already heard; adopting it twice is a second input");
});

test("a submit on another form is not answered", () => {
  const dom = new JSDOM("<form id='mine'><input id='a' value='Ada'></form><form id='theirs'><input /></form>");
  const document = dom.window.document;
  const heard = listen(document);

  adoptSilentWrites({ root: document.getElementById("mine"), navigation: ordinary });
  document.getElementById("a").value = "Grace";
  document.getElementById("theirs").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

  assert.deepEqual(heard, []);
});

test("a control outside the root is neither watched nor adopted", () => {
  const document = page();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), navigation: ordinary });
  document.getElementById("e").value = "Turing";
  submit(document);

  assert.deepEqual(heard, []);
});

// ── Lifetime ──────────────────────────────────────────────────────────────────────────────────

test("a control that appears after the binding is not mistaken for a silent write", () => {
  const document = page();
  const heard = listen(document);

  adoptSilentWrites({ root: root(document), navigation: ordinary });
  const fresh = document.createElement("input");
  fresh.id = "nuovo";
  fresh.value = "Hopper";
  root(document).append(fresh);
  submit(document);

  assert.deepEqual(heard, [], "a field the renderer has just drawn was written by the renderer");
});

test("unbinding stops both halves", () => {
  const document = page();
  const clock = manual();
  const heard = listen(document);

  const stop = adoptSilentWrites({ root: root(document), schedule: clock.schedule, navigation: backForward });
  document.getElementById("a").value = "Grace";
  stop();

  clock.flush();
  submit(document);
  assert.deepEqual(heard, [], "a form torn down must not write to a model that is gone");
});
