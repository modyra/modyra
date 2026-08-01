/**
 * The parts that only exist once something has been supplied.
 *
 * `fileItem` appears once a file is chosen; `prefix` and `suffix` once the field carries content for
 * them. The resting fixture supplies neither, so these parts were declared by the contract and never
 * built by any check. Each one here is driven and then held to the same gate as the rest.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { inspectWidgetDom } = await import("../../widgets/dist/testing/index.js");
const { partsOf } = await import("./contract-parts.mjs");

/** The renderer reads `control.files`, which jsdom leaves unset and read-only. */
function choose(control, names) {
  const files = names.map((name) => new File(["content"], name, { type: "text/plain" }));
  Object.defineProperty(control, "files", {
    configurable: true,
    value: Object.assign(files, { item: (index) => files[index] ?? null }),
  });
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function mountFile() {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{ name: "cv", kind: "file", label: "CV", multiple: true }], { submitLabel: null });
  return host.querySelector('[data-mdy-field="cv"]');
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("a file field with a file chosen conforms, and renders the item", async () => {
  const root = mountFile();
  choose(root.querySelector(".mdy-file-input"), ["report.txt"]);
  await settle();

  assert.ok(root.querySelector(".mdy-file-item"), "no file item rendered");
  const parts = partsOf(root, "file");
  assert.deepEqual(
    inspectWidgetDom(root, "file", {
      parts,
      // The popup-less kinds still declare a placeholder, which a filled field hides.
      absentParts: ["placeholder"],
      strictClasses: true,
      adapterPrefix: "mdy-plain-",
    }),
    [],
  );
});

test("a file field renders one item per file", async () => {
  const root = mountFile();
  choose(root.querySelector(".mdy-file-input"), ["a.txt", "b.txt"]);
  await settle();
  assert.equal(root.querySelectorAll(".mdy-file-item").length, 2);
});

/* ── The affixes ────────────────────────────────────────────────────────────────
 * `prefix` and `suffix` are declared on the free-text kinds and render only when the field supplies
 * content for them, so a fixture that supplies none leaves both parts unbuilt.
 */
test("a text field with a prefix and a suffix conforms, and renders both", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{ name: "amount", kind: "text", label: "Amount", prefix: "€", suffix: "per month" }], { submitLabel: null });
  await settle();

  const root = host.querySelector('[data-mdy-field="amount"]');
  assert.ok(root.querySelector(".mdy-input-prefix"), "no prefix rendered");
  assert.ok(root.querySelector(".mdy-input-suffix"), "no suffix rendered");
  assert.deepEqual(
    inspectWidgetDom(root, "text", {
      parts: partsOf(root, "text"),
      strictClasses: true,
      adapterPrefix: "mdy-plain-",
    }),
    [],
  );
});

test("a text field with no affixes renders neither", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{ name: "bare", kind: "text", label: "Bare" }], { submitLabel: null });
  await settle();
  const root = host.querySelector('[data-mdy-field="bare"]');
  assert.equal(root.querySelector(".mdy-input-prefix"), null);
  assert.equal(root.querySelector(".mdy-input-suffix"), null);
});

/* ── Counter mode ───────────────────────────────────────────────────────────────
 * `optionStep` and `optionCount` exist only on a multiselect in `"multi"` mode, where an option can
 * be taken several times. Every fixture used the default toggle mode, so the two parts were declared
 * and checked nowhere.
 */
test("a counter-mode multiselect renders its steppers and count, and conforms", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{
    name: "tags", kind: "multiselect", label: "Tags", mode: "multi",
    options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
  }], { submitLabel: null });
  await settle();

  const root = host.querySelector('[data-mdy-field="tags"]');
  assert.ok(root.querySelector(".mdy-chip__btn"), "no step button rendered");
  assert.ok(root.querySelector(".mdy-chip__count"), "no count rendered");

  const parts = partsOf(root, "multiselect");
  const issues = inspectWidgetDom(root, "multiselect", {
    parts: {
      ...parts,
      // A repeated part is mapped with every element it rendered: mapping one of several makes each
      // of the others' children look mis-parented.
      optionWrapper: Array.from(root.querySelectorAll(".mdy-chip-wrapper")),
      option: Array.from(root.querySelectorAll(".mdy-chip")),
      optionLabel: Array.from(root.querySelectorAll(".mdy-chip__label")),
      optionStep: Array.from(root.querySelectorAll(".mdy-chip__btn")),
      optionCount: Array.from(root.querySelectorAll(".mdy-chip__count")),
    },
    absentParts: ["chips", "chip", "placeholder", "loading", "empty", "optionCheck"],
    strictClasses: true,
    adapterPrefix: "mdy-plain-",
  });
  assert.deepEqual(issues, []);
});
