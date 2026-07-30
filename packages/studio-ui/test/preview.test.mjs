/**
 * Preview mounts the real controls.
 *
 * These used to assert against hand-written markup — an `<input type="date">` where the contract
 * asks for a datepicker. What matters now is that the control in the panel is the control
 * `@modyra/plain` renders from the same descriptor `compileToContract` emits, bound to the live
 * form, so the assertions are against the mounted DOM rather than a string.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const { buildLiveForm, vanillaReactivity } = await import("../../studio-preview/dist/index.js");
const { dynamicFieldForNode } = await import("../../studio-contract/dist/index.js");
const { previewHeadMarkup, previewTailMarkup, getPreviewHandle, defaultRowValue } = await import("../dist/index.js");
const { mountPreviewFields, previewStructureSignature } = await import("../dist/preview-mount.js");
const { createCheckoutProject } = await import("../../studio-model/test/fixtures/checkout.fixture.mjs");

/** Mounts a project's preview the way the shell does, into a detached container. */
function mount(project, form, mockConfig = {}, reactivity = vanillaReactivity()) {
  const container = document.createElement("div");
  container.className = "preview-fields";
  const mounted = mountPreviewFields(container, project, {
    handleFor: (path) => getPreviewHandle(form, path),
    fieldFor: dynamicFieldForNode,
    reactivity,
    mockConfig,
  });
  return { container, mounted };
}

const nodeNamed = (project, name) => project.schema.children.find((c) => c.name === name);
const hostFor = (container, path) => container.querySelector(`[data-preview-node="${path}"]`);

test("a previewed field is the renderer's own control, bound to the live handle", async () => {
  const project = createCheckoutProject();
  const reactivity = vanillaReactivity();
  const { form } = buildLiveForm(project, { reactivity });
  const { container } = mount(project, form, {}, reactivity);

  const host = hostFor(container, "shipping.city");
  assert.ok(host, "the city field is mounted at its live path");
  // The foundation's shell, drawn by @modyra/plain — not Studio's own idea of what a field looks like.
  assert.ok(host.querySelector(".mdy-renderer"), "wears the contract's renderer root");
  const input = host.querySelector("input");
  assert.ok(input);

  form.f.shipping.city.set("Rome");
  await reactivity.flush();
  assert.equal(input.value, "Rome", "the mounted control follows the live value");
});

test("a datepicker previews as a datepicker, not as a text box", () => {
  const project = createCheckoutProject();
  const dateField = {
    node: "field",
    id: "nd_when",
    name: "when",
    label: "When",
    fieldKind: "date",
    valueType: "string",
    initialValue: "",
    validators: [],
  };
  project.schema.children.push(dateField);

  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const { container } = mount(project, form);

  const host = hostFor(container, "when");
  assert.ok(host);
  assert.ok(host.querySelector(".mdy-renderer--datepicker"), "the datepicker's own root class");
  assert.equal(host.querySelector("input[type=date]"), null, "a native date input is what this replaced");
});

test("a select previews with its real options, and the mock-mode selector is Studio chrome beside the field", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const { container } = mount(project, form);

  const country = hostFor(container, "country");
  assert.ok(country.textContent.includes("Italy"), "the select's real options are rendered");

  // coupon carries checkout's server validator.
  const mock = container.querySelector('[data-preview-mock-mode="impl_validate_coupon"]');
  assert.ok(mock, "a server-validated field gets a mock-mode selector");
  assert.equal(mock.value, "success");
});

test("the checkout array mounts its live rows, with Studio's own add/remove chrome", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const { container } = mount(project, form);

  assert.match(container.querySelector(".preview-array-label").textContent, /Items \(1\)/);
  assert.ok(hostFor(container, "items.0.sku"), "the initial row's fields are mounted at their live paths");
  assert.ok(container.querySelector('[data-preview-array-remove="items"][data-preview-array-index="0"]'));
  assert.ok(container.querySelector('[data-preview-array-push="items"]'));
});

test("a column row mounts as the same grid the canvas uses, and its members are not mounted twice", () => {
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{ kind: "columns", id: "row", columns: [[{ nodeId: "nd_country" }], [{ nodeId: "nd_coupon" }]] }],
  };
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const { container } = mount(project, form);

  const grid = container.querySelector(".mdy-layout-columns");
  assert.ok(grid);
  // Mobile-first, from the same `layoutNodeAttributes` the two shipping renderers call: the row
  // stacks at the narrowest size and takes its declared tracks from `sm` up. Preview used to write
  // the declared count flat, so it drew one arrangement at every width while the form it previews
  // changed at three.
  assert.equal(grid.style.getPropertyValue("--mdy-layout-column-count"), "1");
  assert.equal(grid.style.getPropertyValue("--mdy-layout-column-count-sm"), "2");
  assert.equal(container.querySelectorAll(".mdy-layout-column").length, 2);
  assert.equal(container.querySelectorAll('[data-preview-node="country"]').length, 1);
  assert.equal(container.querySelectorAll('[data-preview-node="coupon"]').length, 1);
});

test("preview honours a v3 slot's placement, on the column that can act on it", () => {
  // Preview is the third renderer of the same layout and it was the one left behind: it wrote the
  // declared count by hand and ignored every slot's `at`, so per-size placement and visibility were
  // authorable, shipped, and invisible in the panel that exists to show them.
  const project = createCheckoutProject();
  project.presentation = {
    layout: [{
      kind: "columns",
      id: "row",
      columns: [
        [{ nodeId: "nd_country" }],
        [{ nodeId: "nd_coupon", at: { base: { hidden: true }, md: { column: 1, hidden: false } } }],
      ],
      at: { sm: 2, lg: 2 },
    }],
  };
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const { container } = mount(project, form);

  const grid = container.querySelector(".mdy-layout-columns");
  assert.equal(grid.style.getPropertyValue("--mdy-layout-column-count-sm"), "2");
  assert.equal(grid.style.getPropertyValue("--mdy-layout-column-count-lg"), "2");

  const cells = container.querySelectorAll(".mdy-layout-column");
  assert.equal(cells.length, 2);
  // The placement lands on the column, which is the grid item — the same reading as the two
  // shipping renderers, so the panel and the form cannot disagree about where a field goes.
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-display"), "none");
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-display-md"), "flex");
  assert.equal(cells[1].style.getPropertyValue("--mdy-layout-column-start-md"), "1");
  // A column with nothing to say is untouched.
  assert.equal(cells[0].style.getPropertyValue("--mdy-layout-column-display"), "");
});

test("the structure signature ignores values and notices a pushed row — that is what stops a remount per keystroke", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const signature = () => previewStructureSignature(project, [], (path) => getPreviewHandle(form, path), {});

  const before = signature();
  form.f.shipping.city.set("Rome");
  assert.equal(signature(), before, "typing must not rebuild the mounted controls");

  form.f.items.push({ sku: "", qty: 1 });
  assert.notEqual(signature(), before, "a new repeater row is a structural change");
});

test("disposing a mount tears the controls down and empties the container", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  const { container, mounted } = mount(project, form);

  assert.ok(container.children.length > 0);
  mounted.dispose();
  assert.equal(container.children.length, 0);
});

test("previewHeadMarkup reports validity, and previewTailMarkup enables Submit only when the form can", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });

  assert.match(previewHeadMarkup(form), /preview-status-badge invalid">Invalid/);
  assert.match(previewTailMarkup(project, form), /data-preview-submit disabled/);

  form.f.shipping.city.set("Rome");
  form.f.shipping.zip.set("00100");
  form.f.items.at(0).sku.set("TSHIRT-BLK-M");
  form.f.items.at(0).qty.set(2);

  assert.match(previewHeadMarkup(form), /preview-status-badge valid">Valid/);
  assert.doesNotMatch(previewTailMarkup(project, form), /data-preview-submit disabled/);
});

test("previewTailMarkup notes a missing submit action, and stays quiet when checkout's real one is configured", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project, { reactivity: vanillaReactivity() });
  assert.doesNotMatch(previewTailMarkup(project, form), /No submit action configured/);

  project.behaviors.submit = undefined;
  assert.match(previewTailMarkup(project, form), /No submit action configured/);
});

test("previewHeadMarkup with no live form (invalid root) reports the reason instead of throwing", () => {
  assert.match(previewHeadMarkup(null), /Preview needs a group at the schema root/);
  assert.equal(previewTailMarkup(createCheckoutProject(), null), "");
});

test("getPreviewHandle walks nested group and array paths, returning null for an unknown path instead of throwing", () => {
  const project = createCheckoutProject();
  const { form } = buildLiveForm(project);
  assert.ok(getPreviewHandle(form, "shipping.city"));
  assert.ok(getPreviewHandle(form, "items.0.sku"));
  assert.equal(getPreviewHandle(form, "does.not.exist"), null);
  assert.equal(getPreviewHandle(null, "country"), null);
});

test("defaultRowValue builds a new array row from the item schema's own field defaults", () => {
  const project = createCheckoutProject();
  assert.deepEqual(defaultRowValue(nodeNamed(project, "items").item), { sku: "", qty: 1 });
});
