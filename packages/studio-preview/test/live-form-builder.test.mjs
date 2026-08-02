import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLiveForm } from "../dist/index.js";
import { vanillaReactivity } from "@modyra/core";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

function memoryStorage() {
  const store = new Map();
  return {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
    _store: store,
  };
}

test("builds a form whose initial value matches the checkout fixture exactly", () => {
  const { form, diagnostics } = buildLiveForm(createCheckoutProject());
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(form.getValue(), {
    country: "IT",
    shipping: { city: "", zip: "" },
    items: [{ sku: "TSHIRT-BLK-M", qty: 2 }],
    coupon: "",
  });
});

test("an injected reactivity instance can observe the live form's own signals from outside (needed by a host that wants its own re-render loop, e.g. studio-ui)", async () => {
  const rx = vanillaReactivity();
  const { form } = buildLiveForm(createCheckoutProject(), { reactivity: rx });
  let calls = 0;
  rx.effect(() => {
    form.f.shipping.city.value();
    calls++;
  });
  assert.equal(calls, 1);
  form.f.shipping.city.set("Rome");
  await rx.flush();
  assert.equal(calls, 2);
});

test("required/pattern validators produce errors produced by @modyra/core validator functions", () => {
  const { form } = buildLiveForm(createCheckoutProject());
  assert.equal(form.f.shipping.city.errors().length, 1);
  form.f.shipping.city.set("Rome");
  assert.equal(form.f.shipping.city.errors().length, 0);

  form.f.shipping.zip.set("abc");
  assert.equal(form.f.shipping.zip.errors().length, 1);
  form.f.shipping.zip.set("00100");
  assert.equal(form.f.shipping.zip.errors().length, 0);
});

test("arrays: rows/push/remove work, and the item-level min(1) validator applies per row", () => {
  const { form } = buildLiveForm(createCheckoutProject());
  assert.equal(form.f.items.length(), 1);
  assert.equal(form.f.items.at(0).qty.errors().length, 0);

  form.f.items.at(0).qty.set(0);
  assert.equal(form.f.items.at(0).qty.errors().length, 1);

  form.f.items.push({ sku: "HAT-01", qty: 1 });
  assert.equal(form.f.items.length(), 2);
  form.f.items.remove(1);
  assert.equal(form.f.items.length(), 1);
});

test("form validator (crossField): emptying the items array produces a real cross-field error at the items path", async () => {
  const { form } = buildLiveForm(createCheckoutProject());
  form.f.items.setAll([]);
  await Promise.resolve();
  assert.ok(form.errorsFor("items")().some((e) => e.message === "Add at least one item to the order"));
  form.f.items.setAll([{ sku: "X", qty: 1 }]);
  await Promise.resolve();
  assert.equal(form.errorsFor("items")().length, 0);
});

// The checkout fixture's own serverValidator config (debounceMs: 400) still applies —
// buildLiveForm only overrides the mock call's own delay, never the field's debounce —
// so every wait below must clear debounceMs + the mock's delayMs, not just the mock delay.

test("server mock: default config eventually resolves valid, and pending() is true while it runs", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { mockConfigByImplId: { impl_validate_coupon: { delayMs: 20 } } });
  form.f.coupon.set("SAVE10");
  await Promise.resolve();
  assert.equal(form.f.coupon.pending(), true);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(form.f.coupon.pending(), false);
  assert.equal(form.f.coupon.errors().length, 0);
});

test("server mock: validValues rejects anything not in the whitelist", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { mockConfigByImplId: { impl_validate_coupon: { delayMs: 5, validValues: ["SAVE10"] } } });
  form.f.coupon.set("BOGUS");
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(form.f.coupon.errors().length > 0);

  form.f.coupon.set("SAVE10");
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(form.f.coupon.errors().length, 0);
});

test("server mock: forceError always fails with the configured message", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { mockConfigByImplId: { impl_validate_coupon: { delayMs: 5, forceError: "Coupon service unavailable" } } });
  form.f.coupon.set("ANY");
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(form.f.coupon.errors().map((e) => e.message), ["Coupon service unavailable"]);
});

test("server mock: forceNetworkFailure rejects instead of resolving, and the engine surfaces it as a real error without crashing", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { mockConfigByImplId: { impl_validate_coupon: { delayMs: 5, forceNetworkFailure: true } } });
  form.f.coupon.set("ANY");
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(form.f.coupon.pending(), false);
  assert.ok(form.f.coupon.errors().some((e) => e.message === "Mock network failure"));
});

test("server mock: a mock slower than the field's own asyncTimeoutMs surfaces a real timeout, not a hang", async () => {
  const project = createCheckoutProject();
  project.schema.children.find((c) => c.name === "coupon").serverValidator.timeoutMs = 30;
  const { form } = buildLiveForm(project, { mockConfigByImplId: { impl_validate_coupon: { delayMs: 5000 } } });
  form.f.coupon.set("X");
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(form.f.coupon.pending(), false);
  assert.ok(form.f.coupon.errors().some((e) => e.kind === "async-timeout"));
});

test("server mock skipWhen: coupon left empty never triggers the async validator at all (isEmpty(self))", async () => {
  const { form } = buildLiveForm(createCheckoutProject());
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(form.f.coupon.pending(), false, "empty coupon must never enter pending — skipWhen(isEmpty(self)) short-circuits it");
});

test("canSubmit becomes true only once every required field is valid and no async validation is pending", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { mockConfigByImplId: { impl_validate_coupon: { delayMs: 5 } } });
  assert.equal(form.state.canSubmit(), false);

  form.f.shipping.city.set("Rome");
  form.f.shipping.zip.set("00100");
  form.f.items.at(0).sku.set("TSHIRT-BLK-M");
  form.f.items.at(0).qty.set(2);
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(form.state.canSubmit(), true);
});

test("draft: excludes coupon, persists other fields, and restores on a fresh form built against the same storage", async () => {
  const storage = memoryStorage();
  const { form: first } = buildLiveForm(createCheckoutProject(), { draftStorage: storage });
  first.f.shipping.city.set("Rome");
  first.f.coupon.set("SECRET");
  await new Promise((r) => setTimeout(r, 500)); // default draft debounce

  const raw = storage.read("checkout-draft");
  assert.ok(raw, "draft must have been written");
  assert.doesNotMatch(raw, /SECRET/, "coupon is excluded from draft (behaviors.draft.exclude)");

  const { form: second } = buildLiveForm(createCheckoutProject(), { draftStorage: storage });
  assert.equal(second.f.shipping.city.value(), "Rome");
  assert.equal(second.f.coupon.value(), "", "excluded field never restores from draft");
});

/**
 * Milestone G proof 6 asks that Studio emit the same public schema the renderers consume, with no
 * privileged path. It has one: this builder reads the project model directly and never calls
 * `compileToContract`, so what the designer watches and what the designer exports are produced by
 * two different pieces of code that nothing compares.
 *
 * These tests pin the divergence rather than assert it away. Whether the preview *should* refuse a
 * project that cannot be exported is a product decision — previewing work in progress is a
 * legitimate thing to want — so the current answer is recorded here and will fail loudly if it
 * changes in either direction.
 */
test("the preview renders a project the exported contract cannot express", async () => {
  const { compileToContract } = await import("../../studio-contract/dist/index.js");
  const project = createCheckoutProject();

  const { contract, diagnostics: compiled } = compileToContract(project);
  const { form, diagnostics: previewed } = buildLiveForm(project);

  // The export reports what it had to drop: a form-level validator and a server validator, neither
  // of which Contract v2 can carry.
  assert.ok(compiled.some((d) => d.code === "UNSUPPORTED_FEATURE"));
  assert.ok(contract, "the checkout fixture is exportable");

  // The preview builds all of it and reports nothing, which is the asymmetry: the designer is shown
  // a working cross-field rule that the exported contract does not contain.
  assert.deepEqual(previewed, []);
  assert.ok(form);
  assert.ok(project.formValidators.length > 0);
});

test("a project that cannot be exported at all still previews clean", async () => {
  const { compileToContract } = await import("../../studio-contract/dist/index.js");
  const project = createCheckoutProject();
  // A select with no options: `studio-model` flags it and `compileToContract` calls it
  // UNCOMPILABLE_FIELD, which blocks the whole compilation.
  const withBroken = {
    ...project,
    schema: {
      ...project.schema,
      children: [
        ...project.schema.children,
        {
          node: "field", id: "fld_broken", name: "broken", label: "Broken",
          fieldKind: "select", valueType: "string", initialValue: "", validators: [], options: [],
        },
      ],
    },
  };

  const { contract, diagnostics: compiled } = compileToContract(withBroken);
  assert.equal(contract, null, "compilation is blocked");
  assert.ok(compiled.some((d) => d.code === "UNCOMPILABLE_FIELD"));

  const { form, diagnostics: previewed } = buildLiveForm(withBroken);
  assert.deepEqual(previewed, [], "the preview reports nothing");
  assert.ok(form, "and builds anyway");
  // Including the field that blocked the export.
  assert.ok(Object.keys(form.value()).includes("broken"));
});
