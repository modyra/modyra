import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../dist/studio.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match[1];
}

function has(declarations, property, value) {
  assert.match(declarations, new RegExp(`${property}\\s*:\\s*${value}\\s*;`));
}

test("the document and Studio shell own a fixed viewport without global scrolling", () => {
  const documentRule = rule("html,\nbody");
  has(documentRule, "width", "100%");
  has(documentRule, "height", "100%");
  has(documentRule, "min-width", "0");
  has(documentRule, "min-height", "0");
  has(documentRule, "overflow", "hidden");

  const studio = rule(".studio");
  has(studio, "width", "100%");
  has(studio, "height", "100dvh");
  has(studio, "min-width", "0");
  has(studio, "min-height", "0");
  has(studio, "overflow", "hidden");
});

test("grid tracks and main surfaces are allowed to shrink instead of overflowing", () => {
  const main = rule(".studio main");
  has(main, "min-width", "0");
  has(main, "min-height", "0");
  has(main, "overflow", "hidden");
  assert.match(main, /grid-template-columns\s*:\s*210px minmax\(0, 1fr\) minmax\(280px, 320px\)\s*;/);

  const column = rule(".canvas-column");
  has(column, "position", "relative");
  has(column, "min-width", "0");
  has(column, "min-height", "0");
  has(column, "overflow", "hidden");

  for (const selector of [".outline", ".canvas", ".inspector-body"]) {
    const declarations = rule(selector);
    has(declarations, "min-width", "0");
    has(declarations, "min-height", "0");
    has(declarations, "overflow", "auto");
    has(declarations, "overscroll-behavior", "contain");
  }
});

test("tabs, header actions and long diagnostic content remain reachable", () => {
  const tabs = rule(".inspector-tabs");
  has(tabs, "min-width", "0");
  has(tabs, "overflow-x", "auto");

  const diagnostic = rule(".diag-message");
  has(diagnostic, "min-width", "0");
  has(diagnostic, "overflow-wrap", "anywhere");
});

test("the compact shell keeps a slim chrome and a floating dock over the canvas", () => {
  const studio = rule(".studio");
  assert.match(studio, /grid-template-rows\s*:\s*40px minmax\(0, 1fr\) 24px\s*;/);

  // The dock floats over the canvas column, and its own overlay must never swallow
  // pointer events for the form underneath it.
  const dock = rule(".dock");
  has(dock, "position", "absolute");
  has(dock, "pointer-events", "none");
  has(rule(".dock > *"), "pointer-events", "auto");

  const templates = rule(".dock-templates");
  assert.match(templates, /grid-template-columns\s*:\s*repeat\(2, minmax\(0, 1fr\)\)\s*;/);
});

test("the canvas keeps the form's own label for assistive tech while showing the editable one", () => {
  const hidden = rule(".plain-canvas-field > label");
  has(hidden, "position", "absolute");
  has(hidden, "width", "1px");
  has(hidden, "height", "1px");
  assert.doesNotMatch(hidden, /display\s*:\s*none/, "display:none would hide it from screen readers too");
});

test("narrow layouts keep a zero-minimum canvas track and mobile-safe padding", () => {
  assert.match(css, /@media \(max-width: 1000px\)[\s\S]*?grid-template-columns:\s*180px minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.canvas\s*\{[\s\S]*?padding:\s*12px 14px/);
});
