import assert from "node:assert/strict";
import { test } from "node:test";
import * as adapterApi from "../dist/adapter.js";
import { createLitForm, field, MdyFormController, required } from "../dist/index.js";
import * as uiApi from "../dist/ui.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("controller requests host updates when tracked state changes", async () => {
  const form = createLitForm({ email: field("", [required()]) });
  let updates = 0;
  const controllers = [];
  const host = {
    addController: (c) => controllers.push(c),
    requestUpdate: () => updates++,
  };
  new MdyFormController(host, [form.f.email.value, form.state.valid]);
  controllers.forEach((c) => c.hostConnected?.());

  form.f.email.set("a@b.co");
  await tick();
  assert.ok(updates >= 1);

  controllers.forEach((c) => c.hostDisconnected?.());
  const frozen = updates;
  form.f.email.set("x@y.z");
  await tick();
  assert.equal(updates, frozen); // disconnected hosts stop updating
});

test("adapter/ui entrypoints expose expected symbols", () => {
  assert.equal(typeof adapterApi.createLitForm, "function");
  assert.equal(typeof adapterApi.MdyFormController, "function");
  assert.equal(typeof uiApi.defineMdyElements, "function");
  assert.equal(typeof uiApi.MdyTextFieldElement, "function");
});
