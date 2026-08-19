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
import { createCheckoutProject, createNestedCollectionProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

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

test("generated Core files compile against package declarations", { skip: !existsSync(coreTypesPath) && "packages/core is not built (run npm run build:core first)" }, async () => {
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

test("generated Core files compile when a row is a collection", { skip: !existsSync(coreTypesPath) && "packages/core is not built (run npm run build:core first)" }, async () => {
  const artifact = await createCoreTarget().generate(createNestedCollectionProject(), {});
  const dir = await mkdtemp(join(tmpdir(), "mdy-studio-target-core-nested-"));
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

test("a record node generates record(), imported as itself and seeded with the rows the author declared", async () => {
  const project = createCheckoutProject();
  const withRecord = {
    ...project,
    formValidators: [],
    behaviors: {},
    implementations: [],
    presentation: { ...project.presentation, layout: [] },
    schema: {
      ...project.schema,
      children: [
        {
          node: "record",
          id: "nd_lines",
          name: "lines",
          label: "Lines",
          item: {
            node: "group",
            id: "nd_line",
            name: "line",
            children: [
              {
                node: "field",
                id: "nd_sku",
                name: "sku",
                fieldKind: "text",
                valueType: "string",
                initialValue: "",
                validators: [{ id: "val_sku_required", kind: "required" }],
              },
            ],
          },
          initialRows: { "tmp:1": { sku: "TSHIRT-BLK-M" } },
          validators: [],
        },
      ],
    },
  };

  const artifact = await createCoreTarget().generate(withRecord, {});
  const formFile = artifact.files.find((f) => f.path === "form.ts");

  assert.match(formFile.content, /lines: record\(/, "the keyed collection is generated as record()");
  assert.match(formFile.content, /import \{[^}]*record[^}]*\} from "@modyra\/core"/, "and record is imported, not assumed");
  assert.match(formFile.content, /initial: \{"tmp:1":\{"sku":"TSHIRT-BLK-M"\}\}/, "the declared rows are the form's initial ones");
  assert.deepEqual(artifact.diagnostics, []);
});

test("a bound that is not a finite number is reported and left out, never emitted as null", async () => {
  // NaN and both infinities have a number's type, so a `typeof` gate let them through — and
  // `JSON.stringify` turns each into `null`. `minLength(null)` accepts everything *and* declares
  // `minLength: null` as a fact the control carries, so an author writes a minimum and the
  // generated form has none, with nothing between the two saying a word.
  const withBound = (value) => {
    const project = createCheckoutProject();
    const field = project.schema.children.find((child) => child.node === "field" && child.name === "coupon");
    field.validators = [{ id: "val_bound", kind: "minLength", value }];
    return project;
  };

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "3"]) {
    const artifact = await createCoreTarget().generate(withBound(value), {});
    const form = artifact.files.find((file) => file.path === "form.ts").content;

    assert.doesNotMatch(form, /minLength\(null\)/, `${String(value)} was emitted as a null bound`);
    assert.doesNotMatch(form, /minLength\(/, `${String(value)} was emitted as a bound at all`);
    const codes = artifact.diagnostics.map((d) => d.code);
    assert.ok(
      codes.includes("MISSING_VALIDATOR_VALUE"),
      `${String(value)} was dropped in silence: ${JSON.stringify(codes)}`,
    );
    // And the contract compiler's own verdict on the same field reaches the target's answer, so a
    // project it cannot express is never called compatible here.
    assert.ok(
      artifact.diagnostics.some((d) => d.severity === "error"),
      `${String(value)} left the target with nothing an author's tooling would stop on`,
    );
  }

  // The control: a finite bound is emitted, and nothing is reported.
  const artifact = await createCoreTarget().generate(withBound(3), {});
  const form = artifact.files.find((file) => file.path === "form.ts").content;
  assert.match(form, /minLength\(3\)/);
  assert.deepEqual(artifact.diagnostics, []);
});
