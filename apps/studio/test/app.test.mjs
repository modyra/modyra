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

test("P11 Workers: build produces its own codegen-worker bundle, separate from the main studio.js entry", () => {
  assert.ok(files.includes("codegen-worker.js"), "missing dist/codegen-worker.js");
  const main = readFileSync(new URL("studio.js", dist), "utf8");
  const worker = readFileSync(new URL("codegen-worker.js", dist), "utf8");
  // typescript (the one dependency this batch adds) must only ever load in the worker bundle —
  // if the main entry pulled it in too, the whole point of the split (small main bundle,
  // heavy compiler off the main thread) would be defeated.
  assert.doesNotMatch(main, /createLanguageService|getPreEmitDiagnostics|ts\.transpileModule/);
  assert.match(worker, /transpileModule/);
  assert.match(main, /new Worker\(/, "main.ts should construct the codegen Worker");
});

test("bundle mounts the framework-free studio-ui shell into [data-modyra-studio], with no actual React/Angular runtime bundled", () => {
  const bundle = readFileSync(new URL("studio.js", dist), "utf8");
  assert.match(bundle, /data-modyra-studio/);
  assert.match(bundle, /mountStudio/);
  // Studio's own codegen targets (studio-target-react/angular) legitimately emit strings like
  // "React (useMdyForm)" and "@modyra/react" as generated *source text*, not real imports —
  // apps/studio depends only on @modyra/studio-ui (see package.json), which has no react/
  // react-dom/@angular/* dependency, so no real framework runtime can have been bundled here.
  // Check for actual framework-runtime fingerprints instead of the word "react"/"angular".
  assert.doesNotMatch(bundle, /Symbol\.for\("react\.element"\)|ReactCurrentDispatcher|from ["']react-dom["']|@angular\/core/);
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
