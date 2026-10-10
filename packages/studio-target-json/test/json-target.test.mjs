/**
 * a (non-dummy) target must be fully conformant, and its
 * output must be the actual project serialization / actual compiled
 * Contract v2 — never a reimplementation of either.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { STUDIO_FIELD_KINDS } from "@modyra/studio-model";
import { createJsonTarget, jsonTargetManifest } from "../dist/index.js";
import { runConformanceSuite } from "@modyra/studio-codegen";
import { serializeProject } from "@modyra/studio-model";
import { compileToContract } from "@modyra/studio-contract";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

test("json target passes the full conformance suite against checkout", async () => {
  const result = await runConformanceSuite(createJsonTarget(), createCheckoutProject());
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

test("generate() emits project.json matching serializeProject exactly", async () => {
  const project = createCheckoutProject();
  const artifact = await createJsonTarget().generate(project, { pretty: true });
  const projectFile = artifact.files.find((f) => f.path === "project.mdy-studio.json");
  assert.ok(projectFile);
  assert.equal(projectFile.content, serializeProject(project));
});

test("generate() emits contract.json matching compileToContract exactly, and it is the entryFile", async () => {
  const project = createCheckoutProject();
  const artifact = await createJsonTarget().generate(project, { pretty: true });
  const { contract, diagnostics } = compileToContract(project);
  const contractFile = artifact.files.find((f) => f.path === "contract.json");
  assert.ok(contractFile);
  assert.equal(contractFile.content, JSON.stringify(contract, null, 2));
  assert.equal(artifact.entryFile, "contract.json");
  assert.deepEqual(artifact.diagnostics, diagnostics);
});

test("analyze() reports compatible:true and no error diagnostics for a valid checkout project", async () => {
  const analysis = await createJsonTarget().analyze(createCheckoutProject(), { pretty: true });
  assert.equal(analysis.compatible, true);
  assert.ok(!analysis.diagnostics.some((d) => d.severity === "error"));
});

test("jsonTargetManifest loads lazily to a target with id 'json'", async () => {
  const target = await jsonTargetManifest.load();
  assert.equal(target.id, "json");
  assert.equal(jsonTargetManifest.displayName, "Contract + Studio JSON");
});

test("json target declares every field kind the model has", () => {
  assert.deepEqual([...createJsonTarget().capabilities.fieldKinds].sort(), [...STUDIO_FIELD_KINDS].sort());
  assert.equal(STUDIO_FIELD_KINDS.length, 14);
});

test("json target emits every model field kind as the control it names, with its options and no unsupported-kind finding", async () => {
  const { createEveryKindProject } = await import("../../studio-model/test/fixtures/every-kind.fixture.mjs");
  const artifact = await createJsonTarget().generate(createEveryKindProject(), {});
  assert.deepEqual(artifact.diagnostics.filter((d) => d.code === "UNSUPPORTED_FIELD_KIND" || d.severity === "error"), []);
  const contract = JSON.parse(artifact.files.find((f) => f.path === "contract.json").content);
  const widgetOf = { date: "datepicker", time: "timepicker" };
  assert.deepEqual(Object.keys(contract.schema.children), [...STUDIO_FIELD_KINDS]);
  for (const kind of STUDIO_FIELD_KINDS) {
    const emitted = contract.schema.children[kind].field;
    assert.equal(emitted.kind, widgetOf[kind] ?? kind, `${kind} was emitted as ${emitted.kind}`);
    const optioned = ["select", "radio", "segmented", "multiselect"].includes(kind);
    assert.equal(Array.isArray(emitted.options), optioned, `${kind} options`);
  }
});
