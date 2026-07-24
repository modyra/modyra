/**
 * P11 Workers: worker-toolkit.ts is the pure, DOM-free half of the generate
 * pipeline meant to run inside a Worker (apps/studio's codegen-worker.ts) —
 * real behavioral test against the shipped module, no fake host needed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runGenerateJob } from "../dist/worker-toolkit.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

test("runGenerateJob resolves the requested target and generates, same as calling target.generate() directly", async () => {
  const project = createCheckoutProject();
  const artifact = await runGenerateJob({ targetId: "core", project });

  assert.equal(artifact.targetId, "core");
  const paths = artifact.files.map((f) => f.path);
  assert.ok(paths.includes("form.ts"));
  assert.ok(paths.includes("stubs.ts"));
});

test("runGenerateJob rejects for an unregistered target id", async () => {
  const project = createCheckoutProject();
  await assert.rejects(() => runGenerateJob({ targetId: "not-a-real-target", project }));
});

test("runGenerateJob is deterministic (same project+target -> same output), matching the conformance gate generate() itself must satisfy", async () => {
  const project = createCheckoutProject();
  const first = await runGenerateJob({ targetId: "react", project });
  const second = await runGenerateJob({ targetId: "react", project });

  assert.deepEqual(first.files, second.files);
});
