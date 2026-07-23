/**
 * Real behavioral tests (executes the shipped module, not a source-text
 * grep) — needs the CSS stub loader registered via `--import
 * ./test/support/register.mjs` (see package.json "test" script) since
 * Node has no native CSS loader and `dist/index.js` imports "./studio.css"
 * (correct for esbuild/Vite consumers).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildIndexes } from "../../studio-model/dist/index.js";
import { mountStudio, serverValidatorMarkup, formValidatorsMarkup } from "../dist/index.js";
import { createCheckoutProject } from "../../studio-model/test/fixtures/checkout.fixture.mjs";

globalThis.confirm ??= () => true;

function createFakeHost() {
  return {
    _html: "",
    get innerHTML() {
      return this._html;
    },
    set innerHTML(value) {
      this._html = value;
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    replaceChildren() {
      this._html = "";
    },
  };
}

test("mounting a blank project renders the on-brand shell without throwing", () => {
  const host = createFakeHost();
  const dispose = mountStudio(host);

  assert.match(host.innerHTML, /class="studio"/);
  assert.match(host.innerHTML, /Modyra Studio/);
  assert.match(host.innerHTML, /Blank project ready/);
  for (const template of ["text", "textarea", "email", "number", "checkbox", "select", "multiselect", "date", "group", "array"]) {
    assert.match(host.innerHTML, new RegExp(`data-template="${template}"`));
  }
  // Blank project has no schema children yet -> empty-state prompt, not a tree.
  assert.match(host.innerHTML, /Start with a blank form/);
  assert.doesNotMatch(host.innerHTML, /<ul class="tree">/);

  dispose();
  assert.equal(host.innerHTML, "");
});

test("mounting the checkout fixture renders its real tree and node count", () => {
  const host = createFakeHost();
  mountStudio(host, createCheckoutProject());

  assert.match(host.innerHTML, /<ul class="tree">/);
  for (const name of ["country", "shipping", "items", "coupon"]) {
    assert.match(host.innerHTML, new RegExp(name));
  }
  // 8 non-root nodes in the fixture: country, shipping, city, zip, items, item, sku, qty, coupon = 9.
  assert.match(host.innerHTML, /9 nodes/);
});

test("P5 gate: checkout's real coupon server validator renders debounce/timeout/skip-empty/implementation", () => {
  const project = createCheckoutProject();
  const idx = buildIndexes(project);
  const coupon = idx.nodeById.get("nd_coupon");

  const markup = serverValidatorMarkup(project, idx, coupon);

  assert.match(markup, /Server validation/);
  assert.match(markup, /value="400"/); // debounceMs
  assert.match(markup, /value="5000"/); // timeoutMs
  assert.match(markup, /data-server-skip-empty checked/); // coupon's skipWhen is isEmpty(self)
  assert.match(markup, new RegExp(`value="impl_validate_coupon"\\s+selected`));
  assert.match(markup, /validateCoupon/); // the implementation's displayName, in the <option> list
});

test("P5 gate: checkout's real items-length form validator renders in the Form validators section", () => {
  const project = createCheckoutProject();
  const idx = buildIndexes(project);
  const draft = { kind: "form", refNodeId: project.schema.id, op: "isNotEmpty", literal: "", errorTargetId: "", message: "" };

  const markup = formValidatorsMarkup(project, idx, draft);

  assert.match(markup, /Form validators/);
  assert.match(markup, /Add at least one item to the order/);
  assert.match(markup, /depends on: items/);
  assert.match(markup, /error target: items/);
});

test("package has no React dependency and source has no React/JSX reference", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(!Object.keys(deps).some((name) => /react/i.test(name)));

  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /react|jsx-runtime/i);
});
