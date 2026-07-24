/**
 * P9 gate: "compiles / Core semantic parity". Semantic parity is checked
 * directly against the real studio-target-core output for the same
 * project (not just eyeballed): once the target-specific factory import
 * and call name are normalized away, the schema/options body must be
 * byte-identical, and stubs.ts always is (buildStubsModule is fully
 * shared, framework-agnostic). "Compiles" is checked, when
 * packages/angular has already been built, against the real
 * @modyra/angular/adapter + @modyra/core types via the real tsc — same
 * technique as studio-target-core's own typecheck test.
 */
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
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

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

test("P9 gate: Core semantic parity — schema/options body matches studio-target-core exactly once the factory call is normalized", async () => {
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
  "generated form.ts + stubs.ts really compile against the real @modyra/angular/adapter + @modyra/core types",
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
