import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, createSSRApp, effectScope, h, nextTick } = await import("vue");
const { renderToString } = await import("vue/server-renderer");
const { field, useVueForm } = await import("../dist/index.js");

test("a form built by useVueForm during a server render starts nothing", async () => {
  let form;
  const app = createSSRApp({
    setup() {
      form = useVueForm({ name: field("") });
      return () => h("p", form.f.name.value());
    },
  });

  await renderToString(app);

  assert.equal(form.deactivated, true);
});

test("a form built by useVueForm in a component starts on mount and pauses on unmount", async () => {
  let form;
  let seenInSetup;
  const app = createApp({
    setup() {
      form = useVueForm({ name: field("") });
      seenInSetup = form.deactivated;
      return () => h("p", form.f.name.value());
    },
  });

  app.mount(document.createElement("div"));
  await nextTick();
  assert.equal(seenInSetup, true);
  assert.equal(form.deactivated, false);

  app.unmount();
  assert.equal(form.deactivated, true);
});

test("a form built by useVueForm outside a component starts at once", () => {
  const scope = effectScope();
  const form = scope.run(() => useVueForm({ name: field("") }));

  assert.equal(form.deactivated, false);
  scope.stop();
});
