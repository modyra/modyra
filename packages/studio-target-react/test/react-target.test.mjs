/**
 * P10 gate: "compiles / Core semantic parity" (plan §14 P10 mirrors P9's
 * gate). Semantic parity checked directly against studio-target-core's
 * output for the same project, same technique as P9. "Compiles" checked
 * for real against the real @modyra/react types, when packages/react has
 * already been built.
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
import { createReactTarget, reactTargetManifest } from "../dist/index.js";
import { createCoreTarget } from "../../studio-target-core/dist/index.js";
import { runConformanceSuite } from "@modyra/studio-codegen";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const reactTypesPath = join(__dirname, "../../react/dist/index.d.ts");
const coreTypesPath = join(__dirname, "../../core/dist/index.d.ts");

test("react target passes the full conformance suite against checkout", async () => {
  const result = await runConformanceSuite(createReactTarget(), createCheckoutProject());
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

test("generate() emits form.ts + stubs.ts only, no submit-example.ts", async () => {
  const artifact = await createReactTarget().generate(createCheckoutProject(), {});
  assert.deepEqual(artifact.files.map((f) => f.path), ["form.ts", "stubs.ts"]);
  assert.equal(artifact.entryFile, "form.ts");
  assert.deepEqual(artifact.diagnostics, []);
});

test("form.ts imports everything (factories + validators) from a single @modyra/react source, never @modyra/core", async () => {
  const artifact = await createReactTarget().generate(createCheckoutProject(), {});
  const formFile = artifact.files.find((f) => f.path === "form.ts");
  assert.match(formFile.content, /import \{ array, crossField, field, group, min, pattern, required, serverValidator, useMdyForm \} from "@modyra\/react";/);
  assert.doesNotMatch(formFile.content, /from "@modyra\/core"/);
});

test("useMdyForm is not called at module scope: form.ts exports a wrapping useForm() hook, and the schema is a thunk", async () => {
  const artifact = await createReactTarget().generate(createCheckoutProject(), {});
  const formFile = artifact.files.find((f) => f.path === "form.ts");
  assert.doesNotMatch(formFile.content, /^export const form =/m);
  assert.match(formFile.content, /export function useForm\(\) \{/);
  assert.match(formFile.content, /return useMdyForm\(\(\) => schema, \{/);
});

test("P10 gate: Core semantic parity — the schema block is byte-identical to studio-target-core's, proving field/validator/serverValidator mapping is truly shared, not reimplemented", async () => {
  const project = createCheckoutProject();
  const react = await createReactTarget().generate(project, {});
  const core = await createCoreTarget().generate(project, {});

  // form.ts's template is `${imports}\n\nconst schema = ${schemaCode};\n\n${exportStatement}` —
  // the middle "\n\n"-delimited section is the schema block, independent of any target's
  // factory/import/call-wrapping choices.
  const schemaBlock = (code) => code.split("\n\n")[1];
  assert.equal(schemaBlock(react.files[0].content), schemaBlock(core.files[0].content));

  // The options object (validators/draft/history) must match too, modulo the outer
  // useMdyForm(() => schema, …) vs createForm(schema, …) call shape and hook-body indent.
  const optionsObject = (code) => {
    const start = code.indexOf("{", code.indexOf("schema, ") + "schema, ".length);
    const closeIdx = code.lastIndexOf("});"); // the call's own close — not a wrapping function's trailing "}"
    const lines = code.slice(start, closeIdx + 1).split("\n");
    const inner = lines.slice(1, -1);
    const minIndent = Math.min(...inner.map((l) => l.match(/^ */)[0].length));
    return [lines[0], ...inner.map((l) => l.slice(minIndent)), lines[lines.length - 1].trimStart()].join("\n");
  };
  assert.equal(optionsObject(react.files[0].content), optionsObject(core.files[0].content));

  const reactStubs = react.files.find((f) => f.path === "stubs.ts");
  const coreStubs = core.files.find((f) => f.path === "stubs.ts");
  assert.equal(reactStubs.content, coreStubs.content);
});

test("reactTargetManifest loads lazily to a target with id 'react'", async () => {
  const target = await reactTargetManifest.load();
  assert.equal(target.id, "react");
});

test(
  "generated form.ts + stubs.ts really compile against the real @modyra/react types",
  { skip: (!existsSync(reactTypesPath) || !existsSync(coreTypesPath)) && "packages/react and packages/core must both be built first (npm run build:packages)" },
  async () => {
    const artifact = await createReactTarget().generate(createCheckoutProject(), {});
    const dir = await mkdtemp(join(tmpdir(), "mdy-studio-target-react-typecheck-"));
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
            jsx: "react-jsx",
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: true,
            noUnusedParameters: false,
            lib: ["ES2022", "DOM"],
            paths: { "@modyra/react": [reactTypesPath], "@modyra/core": [coreTypesPath] },
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
