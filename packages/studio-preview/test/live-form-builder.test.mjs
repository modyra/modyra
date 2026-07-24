/**
 * P11 gate ("Must show"): values, validation, arrays, errors, pending,
 * canSubmit, draft — all exercised against a REAL @modyra/core form built
 * from the checkout fixture, never a mock of the engine itself. Only the
 * server call is mocked (plan §11's own "server mock" concept — a
 * necessity since serverValidator implementations are always symbolic
 * stubs, ADR-0005).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLiveForm } from "../dist/index.js";
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

test("builds a real form whose initial value matches the checkout fixture exactly", () => {
  const { form, diagnostics } = buildLiveForm(createCheckoutProject());
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(form.getValue(), {
    country: "IT",
    shipping: { city: "", zip: "" },
    items: [{ sku: "TSHIRT-BLK-M", qty: 2 }],
    coupon: "",
  });
});

test("required/pattern validators produce real errors, driven by real @modyra/core validator functions", () => {
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
// buildLiveForm only overrides the mock call's own delay, never the field's real debounce —
// so every wait below must clear debounceMs + the mock's delayMs, not just the mock delay.

test("server mock: default config eventually resolves valid, and pending() is true while it runs", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { impl_validate_coupon: { delayMs: 20 } });
  form.f.coupon.set("SAVE10");
  await Promise.resolve();
  assert.equal(form.f.coupon.pending(), true);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(form.f.coupon.pending(), false);
  assert.equal(form.f.coupon.errors().length, 0);
});

test("server mock: validValues rejects anything not in the whitelist", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { impl_validate_coupon: { delayMs: 5, validValues: ["SAVE10"] } });
  form.f.coupon.set("BOGUS");
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(form.f.coupon.errors().length > 0);

  form.f.coupon.set("SAVE10");
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(form.f.coupon.errors().length, 0);
});

test("server mock: forceError always fails with the configured message", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { impl_validate_coupon: { delayMs: 5, forceError: "Coupon service unavailable" } });
  form.f.coupon.set("ANY");
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(form.f.coupon.errors().map((e) => e.message), ["Coupon service unavailable"]);
});

test("server mock: forceNetworkFailure rejects instead of resolving, and the engine surfaces it as a real error without crashing", async () => {
  const { form } = buildLiveForm(createCheckoutProject(), { impl_validate_coupon: { delayMs: 5, forceNetworkFailure: true } });
  form.f.coupon.set("ANY");
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(form.f.coupon.pending(), false);
  assert.ok(form.f.coupon.errors().some((e) => e.message === "Mock network failure"));
});

test("server mock: a mock slower than the field's own asyncTimeoutMs surfaces a real timeout, not a hang", async () => {
  const project = createCheckoutProject();
  project.schema.children.find((c) => c.name === "coupon").serverValidator.timeoutMs = 30;
  const { form } = buildLiveForm(project, { impl_validate_coupon: { delayMs: 5000 } });
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
  const { form } = buildLiveForm(createCheckoutProject(), { impl_validate_coupon: { delayMs: 5 } });
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
  const { form: first } = buildLiveForm(createCheckoutProject(), {}, storage);
  first.f.shipping.city.set("Rome");
  first.f.coupon.set("SECRET");
  await new Promise((r) => setTimeout(r, 500)); // default draft debounce

  const raw = storage.read("checkout-draft");
  assert.ok(raw, "draft must have been written");
  assert.doesNotMatch(raw, /SECRET/, "coupon is excluded from draft (behaviors.draft.exclude)");

  const { form: second } = buildLiveForm(createCheckoutProject(), {}, storage);
  assert.equal(second.f.shipping.city.value(), "Rome");
  assert.equal(second.f.coupon.value(), "", "excluded field never restores from draft");
});
