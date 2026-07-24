/**
 * `main.ts` queries `document` at the top level and is meant to run inside
 * a real browser after esbuild bundling — see apps/studio/test/app.test.mjs
 * for the same reasoning. This verifies the actual build output.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const dist = new URL("../dist/", import.meta.url);
const files = readdirSync(dist);

test("build produces the bundle", () => {
  assert.ok(files.includes("plain-preview.js"));
});

test("bundle wires the expected mount points and never imports a framework", () => {
  const bundle = readFileSync(new URL("plain-preview.js", dist), "utf8");
  assert.match(bundle, /data-plain-json/);
  assert.match(bundle, /data-plain-render/);
  assert.match(bundle, /mountMdyForm/);
  assert.doesNotMatch(bundle, /Symbol\.for\("react\.element"\)|ReactCurrentDispatcher|from ["']react-dom["']|@angular\/core/);
});

test("index.html wires the mount points and bundle output correctly", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-plain-json/);
  assert.match(html, /data-plain-render/);
  assert.match(html, /data-plain-form/);
  assert.match(html, /src="\.\/dist\/plain-preview\.js"/);
});
