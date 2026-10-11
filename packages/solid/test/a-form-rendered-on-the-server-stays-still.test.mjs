import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "solid-js";
import { isServer } from "solid-js/web";
import { field, useSolidForm } from "../dist/index.js";

// The package runs this file twice: under `--conditions=browser` (Solid's client build, where an
// owner mounts after the first flush) and under the default `node` condition (the server build,
// where nothing mounts).
const tick = () => new Promise((r) => setTimeout(r, 0));

test("a form built by useSolidForm inside an owner waits for the mount", async () => {
  let form;
  let seenAtCreation;
  const dispose = createRoot((dispose) => {
    form = useSolidForm({ name: field("") });
    seenAtCreation = form.deactivated;
    return dispose;
  });
  await tick();

  assert.equal(seenAtCreation, true);
  assert.equal(form.deactivated, isServer);
  dispose();
});

test("a form built by useSolidForm with no owner starts at once", () => {
  const form = useSolidForm({ name: field("") });

  assert.equal(form.deactivated, false);
  form.destroy();
});
