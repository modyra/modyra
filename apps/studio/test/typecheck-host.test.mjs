/**
 * typecheck-host.ts is plain, DOM/Worker-free TypeScript (see its own doc
 * comment) — real unit tests against real generated Core/React artifacts,
 * not a source-text guess. Transpiled on the fly via esbuild (already a
 * devDependency here) rather than adding a Node flag/build step just for
 * this one file; codegen-worker.ts's own real bundling (which this feeds)
 * is already covered by app.test.mjs + the e2e suite.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import * as esbuild from "esbuild";
import ts from "typescript";
import { createCoreTarget } from "../../../packages/studio-target-core/dist/index.js";
import { createReactTarget } from "../../../packages/studio-target-react/dist/index.js";
import { createAngularTarget } from "../../../packages/studio-target-angular/dist/index.js";
import { createCheckoutProject } from "../../../packages/studio-model/test/fixtures/checkout.fixture.mjs";

const srcPath = new URL("../src/typecheck-host.ts", import.meta.url);
const assetsPath = new URL("../.generated/typecheck-assets.json", import.meta.url);

async function loadModule() {
  const source = await readFile(srcPath, "utf8");
  const { code } = await esbuild.transform(source, { loader: "ts", format: "esm" });
  // Written under apps/studio/.generated/ (gitignored, already used for the typecheck
  // assets JSON) rather than os.tmpdir() — Node resolves the "typescript" bare import
  // relative to the file's own location, and only this package's node_modules has it.
  const dir = new URL("../.generated/", import.meta.url);
  await mkdir(dir, { recursive: true });
  const fileUrl = new URL("typecheck-host.test-build.mjs", dir);
  await writeFile(fileUrl, code, "utf8");
  try {
    return await import(`${fileUrl.href}?t=${Date.now()}`);
  } finally {
    await rm(fileUrl, { force: true });
  }
}

const { checkTypes, supportsSemanticCheck } = await loadModule();
const assets = JSON.parse(await readFile(assetsPath, "utf8"));
const project = createCheckoutProject();

function tsFilesOf(artifact) {
  return artifact.files.filter((f) => f.language === "typescript").map((f) => ({ path: f.path, content: f.content }));
}

test("core target: checkout's real form.ts+stubs.ts pass real semantic typecheck with zero diagnostics", async () => {
  const artifact = await createCoreTarget().generate(project, {});
  const files = tsFilesOf(artifact);
  assert.equal(supportsSemanticCheck(assets, files), true);
  assert.deepEqual(checkTypes(assets, files), []);
});

test("react target: checkout's real form.ts+stubs.ts pass real semantic typecheck with zero diagnostics", async () => {
  const artifact = await createReactTarget().generate(project, {});
  const files = tsFilesOf(artifact);
  assert.equal(supportsSemanticCheck(assets, files), true);
  assert.deepEqual(checkTypes(assets, files), []);
});

test("angular target: not vendored, supportsSemanticCheck reports false (falls back to syntax-only, no false 'cannot find module')", async () => {
  const artifact = await createAngularTarget().generate(project, {});
  const files = tsFilesOf(artifact);
  assert.equal(supportsSemanticCheck(assets, files), false);
});

test("a real type error in a project file is actually caught, not silently accepted", () => {
  const files = [
    {
      path: "form.ts",
      content: [
        'import { field, createForm } from "@modyra/core";',
        "const schema = { x: field(1, []) };",
        "const bad: string = 5;",
        "export const form = createForm(schema, {});",
        "",
      ].join("\n"),
    },
  ];
  assert.equal(supportsSemanticCheck(assets, files), true);
  const diagnostics = checkTypes(assets, files);
  assert.equal(diagnostics.length, 1);
  assert.match(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, "\n"), /not assignable/);
});

test("an unresolvable bare import is reported as unsupported rather than crashing the host", () => {
  const files = [{ path: "form.ts", content: 'import { x } from "not-a-real-package";\n' }];
  assert.equal(supportsSemanticCheck(assets, files), false);
});
