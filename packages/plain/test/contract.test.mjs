/**
 * Runtime contract conformance for the Plain renderer.
 *
 * `assertWidgetDomContract` comes from `@modyra/widgets/testing` and is the same gate the other
 * adapters answer to: it checks the rendered DOM against the catalog's classes, containment,
 * sibling order and ARIA — not that the source mentions the contract.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { inspectWidgetDom } = await import("../../widgets/dist/testing/index.js");
const { ABSENT, FIELDS, KNOWN_DIVERGENCES, partsOf } = await import("./contract-parts.mjs");

test("every rendered field conforms to its widget DOM contract", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, FIELDS, { submitLabel: null });

  for (const field of FIELDS) {
    const root = host.querySelector(`[data-mdy-field="${field.name}"]`);
    assert.ok(root, `${field.kind} rendered no root`);
    const issues = inspectWidgetDom(root, field.kind, {
      parts: partsOf(root, field.kind),
      absentParts: ABSENT[field.kind] ?? [],
    });
    // Exact match, both ways: a new violation fails, and so does a stale entry left behind by a
    // renderer batch that already fixed it.
    assert.deepEqual(
      issues.map((issue) => `${issue.code}:${issue.part}`),
      KNOWN_DIVERGENCES[field.kind] ?? [],
      `${field.kind}: ${issues.map((issue) => issue.message).join(" / ")}`,
    );
  }

  mounted.dispose();
  host.remove();
});

test("the shell emits the canonical class vocabulary, not adapter equivalents", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "a", kind: "text", label: "A" }], { submitLabel: null });

  const root = host.querySelector(".mdy-renderer");
  for (const className of ["mdy-label", "mdy-label__required", "mdy-input-wrapper", "mdy-input-wrapper__inliner", "mdy-supporting-text", "mdy-control__errors"]) {
    assert.ok(root.querySelector(`.${className}`), `expected ${className}`);
  }
  // The generic names the contract used to emit are gone, not merely shadowed.
  assert.equal(root.querySelector(".mdy-description"), null);
  assert.equal(root.querySelector(".mdy-error"), null);

  mounted.dispose();
  host.remove();
});
