/**
 * P7 gate: "checkout strict-valid"-equivalent for targets — the dummy
 * target must pass the full conformance suite against the real checkout
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
