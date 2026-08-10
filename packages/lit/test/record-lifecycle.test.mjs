/**
 * A Lit element that leaves the document and comes back.
 *
 * Disconnecting is not an edit: the row is the form's. What has to survive is the binding — an
 * element reconnected to the same cell must read the row as it is now, not as it was when it left.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, group, record } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const settled = async (element) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
};

test("an element disconnected and reconnected reads the row as it is now", async () => {
  const form = createLitForm({ rows: record(group({ name: field("") })) });
  form.f.rows.upsert("a", { name: "before" });

  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.rows.cell("a", "name");
  });
  assert.equal(element.querySelector("input").value, "before");

  element.remove();
  form.f.rows.cell("a", "name").set("changed while away");
  document.body.append(element);
  await settled(element);

  assert.equal(element.querySelector("input").value, "changed while away");
  assert.equal(form.value().rows.a.name, "changed while away", "and nothing was lost on the way");
});

test("an element removed for good takes nothing with it", async () => {
  const form = createLitForm({ rows: record(group({ name: field("") })) });
  form.f.rows.upsert("a", { name: "kept" });

  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.rows.cell("a", "name");
  });
  element.remove();

  assert.equal(form.value().rows.a.name, "kept");
  assert.equal(form.f.rows.has("a"), true);
});
