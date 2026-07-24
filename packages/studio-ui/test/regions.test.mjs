/**
 * Region/ScrollMemory are the whole reason a Studio state change no longer
 * resets the editor: identical markup must not touch the DOM, and scroll must
 * be restored *after* content is back, never before.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const { Region, ScrollMemory } = await import("../dist/regions.js");

test("a Region leaves the DOM alone when the markup is unchanged", () => {
  const root = document.createElement("div");
  let binds = 0;
  const region = new Region(root, () => {
    binds += 1;
  });

  assert.equal(region.update("<b>one</b>"), true);
  const firstChild = root.firstChild;
  assert.equal(binds, 1);

  assert.equal(region.update("<b>one</b>"), false);
  assert.equal(root.firstChild, firstChild, "identical markup must not replace the node");
  assert.equal(binds, 1, "a skipped update must not re-bind listeners");

  assert.equal(region.update("<b>two</b>"), true);
  assert.notEqual(root.firstChild, firstChild);
  assert.equal(binds, 2);
});

test("a Region rewrites identical markup again after invalidate()", () => {
  const root = document.createElement("div");
  const region = new Region(root);

  region.update("<i>same</i>");
  assert.equal(region.update("<i>same</i>"), false);
  region.invalidate();
  assert.equal(region.update("<i>same</i>"), true);
});

test("listeners on untouched DOM survive a skipped update", () => {
  const root = document.createElement("div");
  const region = new Region(root, (element) => {
    element.querySelector("button").addEventListener("click", () => {
      clicks += 1;
    });
  });
  let clicks = 0;

  region.update("<button>go</button>");
  region.update("<button>go</button>"); // skipped: must not double-bind, must not drop the listener
  root.querySelector("button").dispatchEvent(new window.MouseEvent("click"));

  assert.equal(clicks, 1);
});

test("ScrollMemory restores offsets captured before a rewrite", () => {
  const canvas = document.createElement("div");
  const inspector = document.createElement("div");
  const memory = new ScrollMemory();
  memory.track(canvas);
  memory.track(inspector);
  memory.track(canvas); // tracking the same element twice must not duplicate it

  canvas.scrollTop = 240;
  canvas.scrollLeft = 12;
  inspector.scrollTop = 88;
  memory.capture();

  canvas.scrollTop = 0;
  canvas.scrollLeft = 0;
  inspector.scrollTop = 0;
  memory.restore();

  assert.equal(canvas.scrollTop, 240);
  assert.equal(canvas.scrollLeft, 12);
  assert.equal(inspector.scrollTop, 88);

  memory.clear();
  canvas.scrollTop = 0;
  memory.restore();
  assert.equal(canvas.scrollTop, 0, "a cleared memory restores nothing");
});
