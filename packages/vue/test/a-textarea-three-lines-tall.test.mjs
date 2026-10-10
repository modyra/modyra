/**
 * A textarea is three lines at rest, stated as `rows` (ADR 0181).
 *
 * Two lines are what the platform draws when nobody decides, and they read as a one-line box that
 * came out wrong. The number is `rows` rather than a height because a length stops meaning "three
 * lines" the moment a person enlarges their text. A renderer that leaves it to the platform draws
 * the same field shorter than every other renderer of the same document.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

test("a textarea is drawn three rows tall", async () => {
  const form = m.createVueForm({ note: field("") });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(m.MdyTextField, { field: form.f.note, label: "Nota", kind: "textarea" }) });
  app.mount(host);
  await nextTick();
  try {
    const box = host.querySelector("textarea");
    assert.ok(box, "no textarea was drawn");
    assert.equal(box.getAttribute("rows"), "3");
  } finally {
    app.unmount();
    host.remove();
  }
});
