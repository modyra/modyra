/**
 * The track a slider spans, and the fill painted on it.
 *
 * These are two readings of one range, and they were computed from different places: the attribute
 * from the field's rules, the fill from a hardcoded 0. A slider bounded at 10 then drew its handle
 * as though the track started at 0 — the control disagreeing with itself, visibly.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, max, min, vanillaReactivity } = await import("@modyra/core");

const host = () => {
  document.body.innerHTML = "";
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

const slider = (extra = {}) => ({ name: "level", kind: "slider", label: "Level", ...extra });
const inputOf = (container) => container.querySelector("input");

test("the track spans the range the field's rules state", () => {
  const rx = vanillaReactivity();
  const form = createForm({ level: field(20, [min(10), max(50)]) }, { reactivity: rx });

  const container = host();
  renderField(container, slider(), form.f.level, rx);

  assert.equal(inputOf(container).getAttribute("min"), "10");
  assert.equal(inputOf(container).getAttribute("max"), "50");
});

test("the painted fill is measured against the same track", () => {
  const rx = vanillaReactivity();
  const form = createForm({ level: field(30, [min(10), max(50)]) }, { reactivity: rx });

  const container = host();
  renderField(container, slider(), form.f.level, rx);

  // 30 is the middle of 10..50, and would be 0.3 of the way along a track that started at 0.
  const fill = inputOf(container).style.getPropertyValue("--mdy-slider-fill").trim();
  assert.equal(fill, "0.5", "the fill and the attributes read one range");
});

test("with no rule the track is what a bare range input assumes", () => {
  const rx = vanillaReactivity();
  const form = createForm({ level: field(50) }, { reactivity: rx });

  const container = host();
  renderField(container, slider(), form.f.level, rx);

  // A slider must span something to be drawn, so where no rule states a range it declares the one
  // a bare `<input type="range">` assumes — the kind's own default, decided by the contract rather
  // than remembered by each renderer.
  assert.equal(inputOf(container).getAttribute("min"), "0");
  assert.equal(inputOf(container).getAttribute("max"), "100");
  assert.equal(inputOf(container).style.getPropertyValue("--mdy-slider-fill").trim(), "0.5");
});

test("the config still narrows what this control offers", () => {
  const rx = vanillaReactivity();
  const form = createForm({ level: field(30, [min(10), max(50)]) }, { reactivity: rx });

  const container = host();
  renderField(container, slider({ min: 20 }), form.f.level, rx);

  assert.equal(inputOf(container).getAttribute("min"), "20");
  assert.equal(inputOf(container).getAttribute("max"), "50");
});
