/**
 * P11 gate ("Loader: read version -> migrate -> normalize -> validate ->
 * project+diagnostics. Do not silently overwrite migrated import."):
 * importProjectFromText is pure (no IndexedDB), fully unit-testable in
 * Node — it reuses studio-model's real loadProject(), never a
 * reimplementation. saveSession/loadSession need a real browser IndexedDB
 * and are covered by apps/studio's E2E suite instead.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { importProjectFromText } from "../dist/storage.js";
import { serializeProject } from "../../studio-model/dist/index.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

test("round-trips a real, valid project through export -> import with no diagnostics", () => {
  const project = createCheckoutProject();
  const result = importProjectFromText(serializeProject(project));
  assert.equal(result.error, null);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.project, project);
});

test("malformed JSON text reports an error, never throws", () => {
  const result = importProjectFromText("{ not json");
  assert.equal(result.project, null);
  assert.match(result.error, /valid JSON/);
});

test("structurally invalid (but syntactically valid JSON) input reports the real StudioModelError message", () => {
  const result = importProjectFromText(JSON.stringify({ hello: "world" }));
  assert.equal(result.project, null);
  assert.match(result.error, /studioVersion|Studio project/);
});

test("a project with a real normalize() warning (e.g. a select with no options) still imports, surfacing diagnostics rather than silently dropping them", () => {
  const project = createCheckoutProject();
  const country = project.schema.children.find((c) => c.name === "country");
  country.fieldKind = "select";
  country.options = [];
  const result = importProjectFromText(serializeProject(project));
  assert.ok(result.project, "a warning-level issue must not block import entirely");
  assert.ok(result.diagnostics.length > 0);
});
