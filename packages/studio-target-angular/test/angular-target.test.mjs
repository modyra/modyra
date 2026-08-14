import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { createAngularTarget, angularTargetManifest } from "../dist/index.js";
import { createCoreTarget } from "../../studio-target-core/dist/index.js";
import { runConformanceSuite } from "@modyra/studio-codegen";
import { createCheckoutProject, createNestedCollectionProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const coreTypesPath = join(__dirname, "../../core/dist/index.d.ts");
const angularAdapterTypesPath = join(__dirname, "../../angular/dist/types/modyra-angular-adapter.d.ts");


test("angular target passes the full conformance suite against checkout", async () => {
  const result = await runConformanceSuite(createAngularTarget(), createCheckoutProject());
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

test("generate() emits form.ts + stubs.ts only — no submit-example.ts (narrower scope than the Core target)", async () => {
  const artifact = await createAngularTarget().generate(createCheckoutProject(), {});
  assert.deepEqual(artifact.files.map((f) => f.path), ["form.ts", "stubs.ts"]);
  assert.equal(artifact.entryFile, "form.ts");
  assert.deepEqual(artifact.diagnostics, []);
});

test("form.ts imports field/group/array/mdyForm from @modyra/angular/adapter, validators from @modyra/core", async () => {
  const artifact = await createAngularTarget().generate(createCheckoutProject(), {});
  const formFile = artifact.files.find((f) => f.path === "form.ts");
  assert.match(formFile.content, /import \{ array, field, group, mdyForm \} from "@modyra\/angular\/adapter";/);
  assert.match(formFile.content, /import \{ crossField, min, pattern, required, serverValidator \} from "@modyra\/core";/);
  assert.match(formFile.content, /export const form = mdyForm\(schema, \{/);
});

test("Angular and Core targets emit equivalent schema definitions", async () => {
  const project = createCheckoutProject();
  const angular = await createAngularTarget().generate(project, {});
  const core = await createCoreTarget().generate(project, {});

  const bodyWithoutImports = (code) => code.split("\n\n").slice(1).join("\n\n").replace(/\bmdyForm\(/, "createForm(");
  assert.equal(bodyWithoutImports(angular.files[0].content), bodyWithoutImports(core.files[0].content));

  const angularStubs = angular.files.find((f) => f.path === "stubs.ts");
  const coreStubs = core.files.find((f) => f.path === "stubs.ts");
  assert.equal(angularStubs.content, coreStubs.content);
});

test("angularTargetManifest loads lazily to a target with id 'angular'", async () => {
  const target = await angularTargetManifest.load();
  assert.equal(target.id, "angular");
});

test(
  "generated Angular files compile against package declarations",
  { skip: (!existsSync(coreTypesPath) || !existsSync(angularAdapterTypesPath)) && "packages/core and packages/angular must both be built first (npm run build:core && npm run build:angular)" },
  async () => {
    const artifact = await createAngularTarget().generate(createCheckoutProject(), {});
    const dir = await mkdtemp(join(tmpdir(), "mdy-studio-target-angular-typecheck-"));
    try {
      for (const file of artifact.files) {
        await writeFile(join(dir, file.path), file.content, "utf8");
      }
      await writeFile(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "nodenext",
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: true,
            noUnusedParameters: false,
            lib: ["ES2022"],
            paths: {
              "@modyra/core": [coreTypesPath],
              "@modyra/angular/adapter": [angularAdapterTypesPath],
            },
          },
          include: ["*.ts"],
        }),
        "utf8",
      );
      const tscBin = join(__dirname, "../../../node_modules/typescript/bin/tsc");
      await execFileAsync(process.execPath, [tscBin, "-p", join(dir, "tsconfig.json")]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test(
  "generated Angular files compile when a collection holds a collection",
  { skip: (!existsSync(coreTypesPath) || !existsSync(angularAdapterTypesPath)) && "packages/core and packages/angular must both be built first (npm run build:core && npm run build:angular)" },
  async () => {
    const artifact = await createAngularTarget().generate(createNestedCollectionProject(), {});
    const form = artifact.files.find((file) => file.path === "form.ts");
    assert.match(form.content, /array\(\s*group\(/, "the nested collection was not emitted");

    const dir = await mkdtemp(join(tmpdir(), "mdy-studio-target-angular-nested-"));
    try {
      for (const file of artifact.files) {
        await writeFile(join(dir, file.path), file.content, "utf8");
      }
      await writeFile(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "nodenext",
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: true,
            noUnusedParameters: false,
            lib: ["ES2022"],
            paths: {
              "@modyra/core": [coreTypesPath],
              "@modyra/angular/adapter": [angularAdapterTypesPath],
            },
          },
          include: ["*.ts"],
        }),
        "utf8",
      );
      const tscBin = join(__dirname, "../../../node_modules/typescript/bin/tsc");
      await execFileAsync(process.execPath, [tscBin, "-p", join(dir, "tsconfig.json")]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

/**
 * An arranged project exports as a form module, and the arrangement does not come with it — this
 * target emits no markup, so there is nowhere for it to go. What must not happen is losing it in
 * silence: a form arranged over four breakpoints would otherwise export as a flat schema with
 * nothing said about it, and the first anyone knew would be when they rendered it.
 */
function arrangedProject() {
  const project = createCheckoutProject();
  // Two real field ids from the fixture: a layout references nodes by id, never by path (ADR-0002).
  const [first, second] = project.schema.children
    .flatMap((child) => (child.node === "group" ? child.children : [child]))
    .filter((child) => child.node === "field")
    .map((child) => child.id);
  return {
    ...project,
    presentation: {
      layout: [
        {
          kind: "section",
          id: "sec_billing",
          label: "Billing",
          children: [
            {
              kind: "columns",
              id: "row_name",
              at: { base: 1, sm: 2 },
              columns: [[{ nodeId: first }], [{ nodeId: second, at: { sm: { column: 2 } } }]],
            },
          ],
        },
      ],
    },
  };
}

test("an arranged project is told its arrangement is not carried into the code", async () => {
  const artifact = await createAngularTarget().generate(arrangedProject(), {});
  const dropped = artifact.diagnostics.filter((d) => d.code === "LAYOUT_NOT_EXPRESSED");
  assert.equal(dropped.length, 1, "the loss must be reported exactly once");
  // Every node, not just the top level: the count is the work that was done.
  assert.match(dropped[0].message, /4 layout nodes/);
  assert.equal(dropped[0].propertyPath, "presentation.layout");
  assert.equal(dropped[0].targetId, "angular");
  // `info`, not an error: a target that cannot draw is not a target that failed, and this must not
  // make a project incompatible.
  assert.equal(dropped[0].severity, "info");
  const analysis = await createAngularTarget().analyze(arrangedProject(), {});
  assert.equal(analysis.compatible, true);
});

test("a project with no arrangement has nothing to report", async () => {
  const artifact = await createAngularTarget().generate(createCheckoutProject(), {});
  assert.deepEqual(artifact.diagnostics.filter((d) => d.code === "LAYOUT_NOT_EXPRESSED"), []);
});

test("the JSON target carries the arrangement, so it reports no loss", async () => {
  const { createJsonTarget } = await import("../../studio-target-json/dist/index.js");
  const artifact = await createJsonTarget().generate(arrangedProject(), { pretty: false });
  assert.deepEqual(artifact.diagnostics.filter((d) => d.code === "LAYOUT_NOT_EXPRESSED"), []);
  // And it is genuinely in there, rather than merely unreported.
  const contract = artifact.files.find((f) => f.path === "contract.json");
  assert.ok(contract, "the JSON target must emit a contract");
  assert.ok(JSON.parse(contract.content).layout, "the contract must carry the layout");
});
