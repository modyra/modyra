/**
 * A host supplies what a document cannot declare, without leaving the one-act door.
 *
 * A document says which rules a field has and *when* its asynchronous checks run — and has no way
 * to say that a field has any, because an asynchronous check is a function and a document is data.
 * A field verified against something only a server can reach therefore needs its check attached by
 * the host.
 *
 * Before `fieldOptions` that meant leaving `mountDynamicForm` entirely and doing parse, build,
 * attach, create and apply by hand — so the simple door and the server-checked form were mutually
 * exclusive, and the moment a form needed a real backend it lost the door built to keep its steps
 * together.
 *
 * What is attached goes through the contract's own channel: the field is `pending` while the answer
 * is in flight and carries what comes back exactly as it carries a rule it checked itself.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountDynamicForm } = await import("../dist/index.js");
const { serverValidator } = await import("@modyra/core");

const DOCUMENT = {
  version: 5,
  id: "checkout",
  fields: [
    { name: "country", kind: "text", label: "Country" },
    { name: "vat", kind: "text", label: "VAT", validators: { required: true } },
  ],
};

const host = () => {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
};

/** A register only the host can reach, standing in for the service. */
const register = (known) => serverValidator(
  async (value) => (String(value ?? "").trim() === "" || value === known ? null : ["No company is registered under that number"]),
  { debounceMs: 0 },
);

test("a check the document could not declare reaches the field", async () => {
  const { form } = mountDynamicForm(host(), DOCUMENT, {
    fieldOptions: { vat: register("IT12345678901") },
  });

  form.f.vat.set("IT00000000000");
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(
    form.f.vat.errors().map((error) => error.message),
    ["No company is registered under that number"],
    "the answer did not arrive on the field the contract's own way",
  );

  form.f.vat.set("IT12345678901");
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(form.f.vat.errors(), [], "the field kept a verdict the register withdrew");
});

test("the field is pending while the answer is in flight", async () => {
  const { form } = mountDynamicForm(host(), DOCUMENT, {
    fieldOptions: {
      vat: serverValidator(
        async () => { await new Promise((resolve) => setTimeout(resolve, 120)); return null; },
        { debounceMs: 0 },
      ),
    },
  });

  form.f.vat.set("IT12345678901");
  // Sampled rather than checked once: `pending` is a window, and a single reading taken at the
  // wrong moment says "never" about a state that was there the whole time.
  const seen = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    seen.push(form.f.vat.pending());
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(seen.some(Boolean), "the field was never pending, so nothing showed the wait");
  assert.equal(form.f.vat.pending(), false, "the field stayed pending after the answer arrived");
});

test("what the document declared survives the host's addition", async () => {
  const { form } = mountDynamicForm(host(), DOCUMENT, {
    fieldOptions: { vat: register("IT12345678901") },
  });
  // `required` came from the document. A host attaching a check must not quietly drop it.
  assert.equal(form.f.vat.required(), true, "the document's own rule was replaced rather than merged");
});

test("a check attached to a field the document does not have is refused", () => {
  assert.throws(
    () => mountDynamicForm(host(), DOCUMENT, { fieldOptions: { taxCode: register("x") } }),
    (error) => {
      assert.match(error.message, /taxCode/, "the refusal did not name the field");
      assert.match(error.message, /country|vat/, "the refusal did not say what the document has");
      return true;
    },
    "a check attached to nothing is a guarantee the host believes is in force",
  );
});
