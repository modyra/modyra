/**
 * "checkout strict-valid"-equivalent for targets — the dummy
 * target must pass the full conformance suite against the checkout
 * fixture. Equally important: the suite must actually *catch* a target
 * that violates each rule — a conformance suite that always passes isn't
 * proving anything, so each failure mode gets its own intentionally-
 * broken target.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runConformanceSuite } from "../dist/index.js";
import { createDummyTarget } from "./fixtures/dummy-target.mjs";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";


/** A target emitting exactly what a case is about, over the dummy target's own shape. */
const GOOD_FILE = { path: "form.ts", language: "ts", role: "source", content: "export {};" };
const PROJECT = createCheckoutProject();
const targetEmitting = (files, diagnostics = []) => ({
  ...createDummyTarget(),
  async generate() {
    return { files, diagnostics };
  },
});

test("the dummy target passes the full conformance suite against checkout", async () => {
  const result = await runConformanceSuite(createDummyTarget(), createCheckoutProject());
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

test("catches a target that mutates its input project", async () => {
  const target = {
    ...createDummyTarget(),
    async generate(project, options) {
      project.name = "mutated!"; // the violation
      return createDummyTarget().generate(project, options);
    },
  };
  const result = await runConformanceSuite(target, createCheckoutProject());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("mutated its input")));
});

test("catches a non-deterministic target", async () => {
  let counter = 0;
  const target = {
    ...createDummyTarget(),
    async generate(project, options) {
      const artifact = await createDummyTarget().generate(project, options);
      counter++;
      return { ...artifact, files: [{ ...artifact.files[0], content: `${artifact.files[0].content}-${counter}` }] };
    },
  };
  const result = await runConformanceSuite(target, createCheckoutProject());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("not deterministic")));
});

test("catches an unsafe file path (absolute or path traversal)", async () => {
  const target = {
    ...createDummyTarget(),
    async generate() {
      return {
        targetId: "dummy",
        files: [{ path: "../../etc/passwd", language: "text", content: "x", role: "source" }],
        diagnostics: [],
      };
    },
  };
  const result = await runConformanceSuite(target, createCheckoutProject());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("unsafe file path")));
});

test("catches a malformed diagnostic (bad severity, missing message)", async () => {
  const target = {
    ...createDummyTarget(),
    async generate() {
      return {
        targetId: "dummy",
        files: [{ path: "form.json", language: "json", content: "{}", role: "source" }],
        diagnostics: [{ code: "X", severity: "catastrophic", message: "" }],
      };
    },
  };
  const result = await runConformanceSuite(target, createCheckoutProject());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("invalid severity")));
  assert.ok(result.failures.some((f) => f.includes("missing a message")));
});

test("catches an entryFile that doesn't match any generated file", async () => {
  const target = {
    ...createDummyTarget(),
    async generate() {
      return {
        targetId: "dummy",
        files: [{ path: "form.json", language: "json", content: "{}", role: "source" }],
        diagnostics: [],
        entryFile: "index.ts",
      };
    },
  };
  const result = await runConformanceSuite(target, createCheckoutProject());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("entryFile")));
});

test("a path that leaves the output directory is refused however it is spelled", async () => {
  // A path is written by a target and resolved by a host, and a host on Windows reads `..\out.ts`
  // exactly as this reads `../out.ts`. Checking one notation is the same shape of hole as a rule
  // that catches `(a|a)*` and misses `([a-z]|[a-z])*`: right about the examples it was written
  // against, blind to the other spelling.
  const B = String.fromCharCode(92);
  const escaping = [
    "../out.ts", "a/../../out.ts", "/etc/passwd",
    `..${B}out.ts`, `a${B}..${B}..${B}out.ts`, `C:${B}out.ts`, `${B}${B}server${B}share`,
    `a/..${B}..${B}out.ts`,
  ];

  for (const path of escaping) {
    const result = await runConformanceSuite(targetEmitting([{ ...GOOD_FILE, path }]), PROJECT);
    assert.equal(result.passed, false, `${JSON.stringify(path)} was admitted`);
    assert.ok(result.failures.some((f) => f.includes("unsafe file path")));
  }

  // The known-good case in the same run: an ordinary relative path passes, so the check is
  // answering about the path rather than refusing everything.
  const ordinary = await runConformanceSuite(targetEmitting([GOOD_FILE]), PROJECT);
  assert.deepEqual(ordinary.failures, []);
});

test("a file is a path, a language, a role and content", async () => {
  // Three were checked. A file with no content, or content that is a number, was conformant — and a
  // host writes what it is handed.
  const noContent = await runConformanceSuite(
    targetEmitting([{ path: "form.ts", language: "ts", role: "source" }]), PROJECT);
  assert.ok(noContent.failures.some((f) => f.includes("no string content")));

  const numeric = await runConformanceSuite(targetEmitting([{ ...GOOD_FILE, content: 42 }]), PROJECT);
  assert.ok(numeric.failures.some((f) => f.includes("no string content")));

  // Two files at one path is a target overwriting its own output, and which one survives depends on
  // how the host iterates.
  const duplicated = await runConformanceSuite(
    targetEmitting([{ ...GOOD_FILE, content: "1" }, { ...GOOD_FILE, content: "2" }]), PROJECT);
  assert.ok(duplicated.failures.some((f) => f.includes("share the path")));
});

test("a target that produces nothing has to say why", async () => {
  // Passing by having nothing to check is the emptiest way through a suite whose purpose is to be
  // passed before a target ships. The legitimate case — a project the target cannot express — is
  // what diagnostics are for, so nothing plus a reason is conformant and nothing alone is not.
  const silent = await runConformanceSuite(targetEmitting([]), PROJECT);
  assert.equal(silent.passed, false);
  assert.ok(silent.failures.some((f) => f.includes("no files and reported no error")));

  const explained = await runConformanceSuite(
    targetEmitting([], [{ code: "UNSUPPORTED_PROJECT", severity: "error", message: "no equivalent" }]),
    PROJECT,
  );
  assert.deepEqual(explained.failures, []);
});
