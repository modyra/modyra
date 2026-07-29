/**
 * The custom properties, held against the stylesheet that reads them.
 *
 * A class that no theme styles looks wrong on screen. A custom property that no theme reads looks
 * *fine* — the popup simply appears at the top-left of the page, the grid collapses to one column,
 * the slider track stays empty — which is why the names have to be checked mechanically rather than
 * by looking. These assertions tie the vocabulary to the foundation in both directions: nothing the
 * renderers write is unread, and nothing the foundation reads is unwritten.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { MDY_CSS_PROPERTIES, MDY_CSS_PROPERTY_NAMES } from "../dist/index.js";

// Every shipped stylesheet, not only the foundation: a theme is free to be the only one that needs a
// number. `--mdy-segments-count` is read by iOS alone, because only iOS slides a pill along the
// group — and `modyra-base.css` says in as many words that it does not define it.
const STYLES = new URL("../../styles/src/", import.meta.url);
const stylesheets = readdirSync(STYLES).filter((f) => f.endsWith(".css"));
const css = stylesheets.map((f) => readFileSync(new URL(f, STYLES), "utf8")).join("\n");

/** Read by a rule. */
const isRead = (name) => css.includes(`var(${name}`);
/** Given a value by a rule, which makes it a design token rather than something a renderer writes. */
const isDeclared = (name) => new RegExp(`^\\s*${name}\\s*:`, "m").test(css);

test("every name is spelled as a custom property", () => {
  for (const name of MDY_CSS_PROPERTY_NAMES) assert.match(name, /^--[a-z][a-z0-9-]*$/, name);
  // No duplicates: two groups naming the same property would be two owners for one number.
  assert.equal(new Set(MDY_CSS_PROPERTY_NAMES).size, MDY_CSS_PROPERTY_NAMES.length);
});

test("every property the contract defines is read by a rule somewhere", () => {
  for (const name of MDY_CSS_PROPERTY_NAMES) {
    assert.ok(isRead(name), `${name} is written by a renderer and read by nothing`);
  }
});

test("no rule reads an overlay property no renderer is contracted to write", () => {
  // Two other things share the `--mdy-overlay-` prefix and are not placement at all. A name the
  // stylesheets *declare* is a design token: the backdrop's colour is `--mdy-overlay-backdrop-bg`,
  // given a value in the foundation. A name read *with a fallback* is a theming hook — optional by
  // construction, since the fallback is what happens when nobody sets it.
  //
  // What is left is read, unconditionally, and given a value by nobody: that can only be something a
  // renderer is supposed to supply, and the contract has to name it or the rule is a rule about a
  // number that never arrives.
  const declared = new Set(Object.values(MDY_CSS_PROPERTIES.overlay));
  const read = [...css.matchAll(/var\((--mdy-overlay-[a-z-]+)(\s*,)?/g)];
  for (const [, name, hasFallback] of read) {
    if (hasFallback || isDeclared(name)) continue;
    assert.ok(declared.has(name), `a rule reads ${name}, which no renderer is contracted to write`);
  }
});

test("the dial index is the one property still outside the namespace", () => {
  // Recorded rather than asserted away: `--index` is what every theme reads today, and renaming it
  // is a change to the themes as much as to the renderers. The test exists so the exception stays a
  // known one instead of becoming a precedent.
  const unnamespaced = MDY_CSS_PROPERTY_NAMES.filter((name) => !name.startsWith("--mdy-"));
  assert.deepEqual(unnamespaced, ["--index"]);
});
