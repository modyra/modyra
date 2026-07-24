/**
 * flattenContractFields is the bridge a Contract renderer (@modyra/plain's
 * mountMdyForm, used by Studio's own Plain preview tab) consumes — real
 * behavioral test against the checkout fixture's actual compiled output.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileToContract, flattenContractFields } from "../dist/index.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

test("flattens checkout's real compiled contract to the same field names/order flattenDynamicSchema itself produces", () => {
  const { contract, diagnostics } = compileToContract(createCheckoutProject());
  assert.ok(contract, () => `expected a non-null contract, diagnostics: ${JSON.stringify(diagnostics)}`);

  const fields = flattenContractFields(contract);
  assert.deepEqual(
    fields.map((f) => f.name),
    ["country", "shipping.city", "shipping.zip", "items.0.sku", "items.0.qty", "coupon"],
  );
  const country = fields[0];
  assert.equal(country.kind, "select");
  assert.deepEqual(country.options, [{ value: "IT", label: "Italy" }]);
});
