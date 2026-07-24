/**
 * P7 gate: "dummy target needs no canvas change" — registering this target
 * touches nothing in studio-model/studio-editor/studio-ui, only this
 * registry. "Failure cannot corrupt editor": load() throwing for an
 * unregistered id must not leave the registry in a broken state.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { TargetRegistry } from "../dist/index.js";
import { createDummyTargetManifest } from "./fixtures/dummy-target.mjs";

test("register + list: a registered manifest appears without ever calling load()", () => {
  const registry = new TargetRegistry();
  let loadCalls = 0;
  registry.register({
    id: "dummy",
    displayName: "Dummy (JSON echo)",
    load: async () => {
      loadCalls++;
      return createDummyTargetManifest().load();
    },
  });

  assert.deepEqual(registry.list(), [{ id: "dummy", displayName: "Dummy (JSON echo)" }]);
  assert.equal(registry.has("dummy"), true);
  assert.equal(loadCalls, 0, "load() must not run just from registering/listing — this is the 'lazy' in lazy registry");
});

test("load() is lazy on first call and cached after (load() only runs once)", async () => {
  const registry = new TargetRegistry();
  let loadCalls = 0;
  registry.register({
    id: "dummy",
    displayName: "Dummy",
    load: async () => {
      loadCalls++;
      return createDummyTargetManifest().load();
    },
  });

  const first = await registry.load("dummy");
  const second = await registry.load("dummy");
  assert.equal(loadCalls, 1);
  assert.equal(first, second, "the cached instance is reused, not reconstructed");
});

test("registering the same id twice throws (no silent overwrite)", () => {
  const registry = new TargetRegistry();
  registry.register(createDummyTargetManifest());
  assert.throws(() => registry.register(createDummyTargetManifest()));
});

test("loading an unregistered id throws without corrupting the registry", async () => {
  const registry = new TargetRegistry();
  registry.register(createDummyTargetManifest());

  await assert.rejects(() => registry.load("does-not-exist"));
  // The registry is still fully usable after the rejected load — a failure here can't corrupt it.
  const dummy = await registry.load("dummy");
  assert.equal(dummy.id, "dummy");
});
