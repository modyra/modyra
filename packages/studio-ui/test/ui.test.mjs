/**
 * Real behavioral tests (executes the shipped module against a jsdom
 * DOM, not a source-text grep) — needs the CSS stub loader registered via
 * `--import ./test/support/register.mjs` (see package.json "test" script)
 * since Node has no native CSS loader and `dist/index.js` imports
 * "./studio.css" (correct for esbuild/Vite consumers).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { installDomGlobals, createHost } from "./support/dom-env.mjs";

installDomGlobals();

const { buildIndexes } = await import("../../studio-model/dist/index.js");
const { mountStudio, serverValidatorMarkup, formValidatorsMarkup } = await import("../dist/index.js");
const { createCheckoutProject } = await import("../../studio-model/test/fixtures/checkout.fixture.mjs");

const click = (element) => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const change = (element) => element.dispatchEvent(new window.Event("change", { bubbles: true }));

/** Opens the floating toolbar, where every non-composition action now lives. */
function openDock(host) {
  click(host.querySelector("[data-dock-toggle]"));
  return host;
}

/** The outline rail renders the same tree markup the canvas mode used to. */
function outlineNode(host, nodeId) {
  const node = host.querySelector(`.outline [data-node="${nodeId}"]`);
  assert.ok(node, `expected an outline node for ${nodeId}`);
  return node.outerHTML;
}

test("mounting a blank project opens on the live form, not a tree or a palette", () => {
  const host = createHost();
  const dispose = mountStudio(host);

  assert.match(host.innerHTML, /class="studio"/);
  assert.match(host.innerHTML, /Blank project ready/);
  assert.equal(host.querySelector("[data-canvas-surface]").dataset.canvasSurface, "form");
  assert.doesNotMatch(host.innerHTML, /<ul class="tree">/);
  assert.equal(host.querySelector(".palette"), null, "the palette column is gone");
  assert.equal(host.querySelector("[data-dock-panel]").hidden, true, "the toolbar starts collapsed");

  dispose();
  assert.equal(host.innerHTML, "");
});

test("the toolbar exposes the templates, history and project I/O", () => {
  const host = createHost();
  mountStudio(host);
  openDock(host);

  const panel = host.querySelector("[data-dock-panel]");
  assert.equal(panel.hidden, false);
  for (const template of ["text", "textarea", "email", "number", "checkbox", "select", "multiselect", "date", "group", "array"]) {
    assert.ok(panel.querySelector(`[data-template="${template}"]`), `missing template ${template}`);
  }
  for (const action of ["[data-undo]", "[data-redo]", "[data-new]", "[data-import]"]) {
    assert.ok(panel.querySelector(action), `missing action ${action}`);
  }
});

test("the form name is edited in the header and committed through a real command", () => {
  const host = createHost();
  mountStudio(host);

  const nameInput = host.querySelector("[data-form-name]");
  assert.ok(nameInput, "expected an inline form-name editor in the header");
  nameInput.value = "Checkout form";
  change(nameInput);

  assert.equal(host.querySelector("[data-form-name]").value, "Checkout form");
  // Committed as a command, so Undo can take it back.
  openDock(host);
  assert.equal(host.querySelector("[data-undo]").disabled, false);
});

test("every live field carries its own label and code-name editors", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const city = host.querySelector('[data-inline-edit="label"][data-inline-node="nd_city"]');
  const cityName = host.querySelector('[data-inline-edit="name"][data-inline-node="nd_city"]');
  assert.ok(city, "expected an inline label editor on the city field");
  assert.equal(cityName.value, "city");

  city.value = "Town";
  change(city);
  assert.equal(host.querySelector('[data-inline-edit="label"][data-inline-node="nd_city"]').value, "Town");
});

test("a blank code name is refused and the old one restored, instead of committing a rename", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const cityName = host.querySelector('[data-inline-edit="name"][data-inline-node="nd_city"]');
  cityName.value = "   ";
  change(cityName);

  assert.equal(cityName.value, "city");
});

test("selecting a field does not remount the live form", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const control = host.querySelector('.plain-canvas-field[data-node="nd_city"] input:not(.plain-canvas-inline)');
  assert.ok(control, "expected a real rendered control for city");

  click(host.querySelector('[data-plain-select="nd_zip"]'));

  assert.equal(
    host.querySelector('.plain-canvas-field[data-node="nd_city"] input:not(.plain-canvas-inline)'),
    control,
    "the running form must survive a selection change",
  );
  assert.equal(host.querySelector('[data-plain-select="nd_zip"]').getAttribute("aria-pressed"), "true");
});

test("the outline rail is always present, beside the live form", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const outline = host.querySelector(".outline");
  assert.ok(outline, "expected a persistent outline rail");
  assert.ok(outline.querySelector("ul.tree"));
  for (const name of ["country", "shipping", "items", "coupon"]) {
    assert.match(outline.innerHTML, new RegExp(name));
  }
  // Both surfaces at once: no mode switch to find, no tree/canvas either-or.
  assert.equal(host.querySelector("[data-canvas-surface]").dataset.canvasSurface, "form");
  assert.ok(host.querySelector(".plain-canvas-field"));
});

test("the outline is one tab stop, not one per node", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const nodes = Array.from(host.querySelectorAll(".outline [data-node]"));
  assert.ok(nodes.length > 3, "checkout has several nodes");
  const focusable = nodes.filter((node) => node.tabIndex === 0);
  assert.equal(focusable.length, 1, "roving tabindex: exactly one node is tabbable");
});

test("at-a-glance tree indicators reflect checkout's real validators (no need to open the inspector)", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const nodeMarkup = (nodeId) => outlineNode(host, nodeId);

  // city: exactly one "required" validator -> required marker only, no count badge.
  const cityNode = nodeMarkup("nd_city");
  assert.match(cityNode, /indicator required/);
  assert.doesNotMatch(cityNode, /indicator count/);

  // zip: "required" + "pattern" -> required marker AND a count badge of 1 (the non-required validator).
  const zipNode = nodeMarkup("nd_zip");
  assert.match(zipNode, /indicator required/);
  assert.match(zipNode, /indicator count"[^>]*>1</);

  // coupon: has a serverValidator -> the server indicator, no field-level validators at all.
  const couponNode = nodeMarkup("nd_coupon");
  assert.match(couponNode, /indicator server/);
  assert.doesNotMatch(couponNode, /indicator required/);
});

test("the header reports the real field count for the checkout fixture", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());
  // country, city, zip, sku, qty, coupon -> 6 fields (groups and arrays are not fields).
  assert.match(host.querySelector(".form-meta").textContent, /6 fields/);
});

test("checkout's real coupon server validator renders debounce/timeout/skip-empty/implementation", () => {
  const project = createCheckoutProject();
  const idx = buildIndexes(project);
  const coupon = idx.nodeById.get("nd_coupon");

  const markup = serverValidatorMarkup(project, idx, coupon);

  assert.match(markup, /value="400"/); // debounceMs
  assert.match(markup, /value="5000"/); // timeoutMs
  assert.match(markup, /data-server-skip-empty checked/); // coupon's skipWhen is isEmpty(self)
  assert.match(markup, new RegExp(`value="impl_validate_coupon"\\s+selected`));
  assert.match(markup, /validateCoupon/); // the implementation's displayName, in the <option> list
});

test("checkout's real items-length form validator renders in the Form validators section", () => {
  const project = createCheckoutProject();
  const idx = buildIndexes(project);
  const draft = { kind: "form", refNodeId: project.schema.id, op: "isNotEmpty", literal: "", errorTargetId: "", message: "" };

  const markup = formValidatorsMarkup(project, idx, draft);

  assert.match(markup, /Add at least one item to the order/);
  assert.match(markup, /depends on: items/);
  assert.match(markup, /error target: items/);

  // checkout's submit action (impl_create_order) renders, selected.
  assert.match(markup, /Submit action/);
  assert.match(markup, new RegExp(`value="impl_create_order"\\s+selected`));
  assert.match(markup, /createOrder/);
});

test("the Diagnostics tab badge reflects checkout's one real warning (the server validator), 0 errors", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  const badge = host.querySelector('[data-inspector-tab="diagnostics"] .badge');
  assert.ok(badge, "expected the Diagnostics tab badge in the markup");
  // One, not two: the cross-field validator now compiles into the contract's `validations` slot, so
  // the only thing still unmappable is the server validator.
  assert.equal(badge.textContent, "1");
  assert.doesNotMatch(badge.className, /badge-error/); // warnings only -> not the error-colored badge

  // The coupon's server validator is the one diagnostic with a concrete nodeId -> the live field is marked.
  assert.ok(host.querySelector('.plain-canvas-field[data-node="nd_coupon"].has-diagnostic'));
});

test("a blank project is diagnostic-free (Diagnostics tab badge shows nothing)", () => {
  const host = createHost();
  mountStudio(host);
  assert.equal(host.querySelector('[data-inspector-tab="diagnostics"] .badge'), null);
});

test("package has no actual React runtime dependency and source has no JSX (studio-target-react is a text-codegen package, not React itself)", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(!("react" in deps) && !("react-dom" in deps));

  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']react["']|from ["']react-dom["']|jsx-runtime/);
});

