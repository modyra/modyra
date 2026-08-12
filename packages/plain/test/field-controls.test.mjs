/**
 * What a mounted field can still be told.
 *
 * This renderer returned a teardown and nothing else, which is enough for a field whose
 * configuration never moves. Two things do move: an option list that arrives from a fetch, and a
 * range of dates that narrows when a sibling is answered. The controllers behind those kinds take
 * both, and this was the one adapter with no door to reach them through — so a plain option field
 * could not be given a new list at all.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field } = await import("../../core/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("a chooser can be given a new list without being remounted", async () => {
  const form = createForm({ plan: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = renderField(
    host,
    { name: "plan", kind: "radio", label: "Plan", options: [{ value: "a", label: "A" }] },
    form.f.plan,
    form.reactivity,
  );
  await settle();
  assert.equal(host.querySelectorAll("input[type=radio]").length, 1);

  assert.equal(typeof mounted.setOptions, "function", "a chooser with no door is a chooser nobody can update");
  mounted.setOptions([
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ]);
  await settle();
  assert.equal(host.querySelectorAll("input[type=radio]").length, 3, "the new list never reached the DOM");

  // Still the teardown it always was: the door is carried on it, not returned beside it.
  mounted();
  assert.equal(host.querySelector("input"), null);
  host.remove();
});

test("a calendar can be told its range moved", async () => {
  const form = createForm({ when: field("2026-07-15") });
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = renderField(
    host,
    { name: "when", kind: "datepicker", label: "When" },
    form.f.when,
    form.reactivity,
  );
  await settle();
  assert.equal(typeof mounted.setBounds, "function");

  host.querySelector(".mdy-datepicker__toggle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  mounted.setBounds("2026-07-10", "2026-07-20");
  await settle();

  const enabled = [...host.querySelectorAll(".mdy-datepicker__cell")].filter((c) => !c.disabled);
  assert.ok(enabled.length > 0 && enabled.length <= 11, "the moved bounds did not reach the grid");

  mounted();
  host.remove();
});
