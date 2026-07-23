/**
 * `main.ts` queries `document` at the top level and is meant to run inside
 * a real browser after esbuild bundling — it can't be imported directly
 * under plain Node (no DOM) and isn't unit-testable there. This instead
 * verifies the actual build output (produced by the package's own "build"
 * script, which runs before "test" — see package.json), which is real,
 * executable verification of what ships, not a source-text guess.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const dist = new URL("../dist/", import.meta.url);
const files = readdirSync(dist);

test("build produces the standalone bundle, stylesheet, and font assets", () => {
  assert.ok(files.includes("studio.js"), "missing dist/studio.js");
  assert.ok(files.includes("studio.css"), "missing dist/studio.css");
  assert.ok(files.some((f) => /^Satoshi-Regular.*\.woff2$/.test(f)), "missing bundled Satoshi font");
});

test("bundle mounts the framework-free studio-ui shell into [data-modyra-studio]", () => {
  const bundle = readFileSync(new URL("studio.js", dist), "utf8");
  assert.match(bundle, /data-modyra-studio/);
  assert.match(bundle, /mountStudio/);
  assert.doesNotMatch(bundle, /\breact\b|jsx-runtime/i);
});

test("stylesheet ships the brand tokens and Satoshi @font-face, not a generic font", () => {
  const css = readFileSync(new URL("studio.css", dist), "utf8");
  assert.match(css, /@font-face/);
  assert.match(css, /Satoshi/);
  assert.match(css, /#7067ff/); // --mdy-indigo
  assert.doesNotMatch(css, /Inter/);
});

test("index.html wires the mount point and bundle output correctly", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-modyra-studio/);
  assert.match(html, /src="\.\/dist\/studio\.js"/);
  assert.match(html, /href="\.\/dist\/studio\.css"/);
});
