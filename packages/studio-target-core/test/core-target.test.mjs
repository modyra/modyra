/**
 * P8 gate: "checkout matches expected semantics / compiles / deterministic
 * / no unused imports". Determinism and no-mutation are already exercised
 * generically by studio-codegen's conformance suite (P7); "compiles" is
 * verified for real here by running the actual generated files through the
 * real `tsc`, type-checked against the real @modyra/core package — never a
 * hand-rolled "looks like valid code" heuristic.
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
import { createCoreTarget, coreTargetManifest } from "../dist/index.js";
import { runConformanceSuite } from "@modyra/studio-codegen";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const coreTypesPath = join(__dirname, "../../core/dist/index.d.ts");

test("core target passes the full conformance suite against checkout", async () => {
  const result = await runConformanceSuite(createCoreTarget(), createCheckoutProject());
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

test("generate() emits form.ts, stubs.ts, submit-example.ts for checkout (it declares a submit action)", async () => {
  const artifact = await createCoreTarget().generate(createCheckoutProject(), {});
  assert.deepEqual(artifact.files.map((f) => f.path), ["form.ts", "stubs.ts", "submit-example.ts"]);
  assert.equal(artifact.entryFile, "form.ts");
  assert.deepEqual(artifact.diagnostics, []);
});

test("form.ts references every checkout field by name and imports asyncDependsOn as a real derived path, not a raw node ID", async () => {
  const artifact = await createCoreTarget().generate(createCheckoutProject(), {});
  const formFile = artifact.files.find((f) => f.path === "form.ts");
  assert.match(formFile.content, /country: field\("IT"\)/);
  assert.match(formFile.content, /city: field\("", \[required\(\)\]\)/);
  assert.match(formFile.content, /dependsOn: \["country"\]/);
  assert.doesNotMatch(formFile.content, /nd_/);
});

test("submit-example.ts wires the real submit stub into form.submit()", async () => {
  const artifact = await createCoreTarget().generate(createCheckoutProject(), {});
  const submitFile = artifact.files.find((f) => f.path === "submit-example.ts");
  assert.match(submitFile.content, /form\.submit\(createOrder\)/);
});

test("a project with no submit action omits submit-example.ts", async () => {
  const project = createCheckoutProject();
  project.behaviors.submit = undefined;
  const artifact = await createCoreTarget().generate(project, {});
  assert.deepEqual(artifact.files.map((f) => f.path), ["form.ts", "stubs.ts"]);
});

test("coreTargetManifest loads lazily to a target with id 'core'", async () => {
  const target = await coreTargetManifest.load();
  assert.equal(target.id, "core");
});

test("generated form.ts + stubs.ts + submit-example.ts really compile against the real @modyra/core types", { skip: !existsSync(coreTypesPath) && "packages/core is not built (run npm run build:core first)" }, async () => {
  const artifact = await createCoreTarget().generate(createCheckoutProject(), {});
  const dir = await mkdtemp(join(tmpdir(), "mdy-studio-target-core-typecheck-"));
  try {
    for (const file of artifact.files) {
      await writeFile(join(dir, file.path.replace(/\.ts$/, ".ts")), file.content, "utf8");
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
          paths: { "@modyra/core": [coreTypesPath] },
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
});
