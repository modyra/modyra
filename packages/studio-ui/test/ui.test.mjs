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
import { mountStudio } from "../dist/index.js";
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

test("package has no React dependency and source has no React/JSX reference", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(!Object.keys(deps).some((name) => /react/i.test(name)));

  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /react|jsx-runtime/i);
});
