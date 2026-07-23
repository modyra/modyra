/**
 * P5 gate: "bad compatibility diagnosed" relies on this registry being the
 * single source of truth both the model (studio-editor's command validation)
 * and the UI (only ever offering compatible options) agree on.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIELD_VALIDATOR_REGISTRY,
  compatibleValidatorKinds,
  isDuplicateKindAllowed,
  isValidatorCompatible,
} from "../dist/index.js";

test("every registry entry's defaultConfig() carries neither id nor kind", () => {
  for (const entry of FIELD_VALIDATOR_REGISTRY) {
    const config = entry.defaultConfig();
    assert.ok(!("id" in config));
    assert.ok(!("kind" in config));
  }
});

test("isValidatorCompatible matches the registry's declared value types", () => {
  assert.equal(isValidatorCompatible("required", "string"), true);
  assert.equal(isValidatorCompatible("email", "number"), false);
  assert.equal(isValidatorCompatible("min", "number"), true);
  assert.equal(isValidatorCompatible("min", "string"), false);
  assert.equal(isValidatorCompatible("pattern", "string"), true);
  assert.equal(isValidatorCompatible("eachOneOf", "string[]"), true);
  assert.equal(isValidatorCompatible("eachOneOf", "string"), false);
});

test("compatibleValidatorKinds narrows to only what a value type supports", () => {
  const forNumber = compatibleValidatorKinds("number");
  assert.ok(forNumber.includes("min"));
  assert.ok(forNumber.includes("max"));
  assert.ok(!forNumber.includes("email"));
  assert.ok(!forNumber.includes("pattern"));
});

test("duplicate-kind policy: pattern/customRef allow repeats, most others don't", () => {
  assert.equal(isDuplicateKindAllowed("pattern"), true);
  assert.equal(isDuplicateKindAllowed("customRef"), true);
  assert.equal(isDuplicateKindAllowed("required"), false);
  assert.equal(isDuplicateKindAllowed("min"), false);
});
