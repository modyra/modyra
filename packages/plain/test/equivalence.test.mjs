/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * Milestone C's question is whether three renderers given the same schema and the same actions
 * produce the same observation. The expectation lives in `@modyra/widgets/testing`, declared once —
 * an expectation written here would be one of three that happen to agree today. This file only
 * mounts the widget and hands over the root.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AT_REST } =
  await import("../../widgets/dist/testing/index.js");

/** Divergences this renderer is allowed, each with the reason it is not a defect. */
const KNOWN_DIVERGENCES = {};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

for (const [kind, expectation] of Object.entries(MDY_CANONICAL_AT_REST)) {
  test(`${kind} produces the canonical observation at rest`, async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = mountMdyForm(
      host,
      [{ name: "f", kind, label: "F", options: [{ value: "a", label: "A" }] }],
      { submitLabel: null },
    );
    await settle();
    try {
      const root = host.querySelector('[data-mdy-field="f"]');
      // A portalled popup is still this widget's, and a snapshot that could not see it would call
      // every lifted overlay absent.
      const portalRoots = Array.from(document.body.children).filter(
        (element) => !host.contains(element) && element.querySelector?.("[class*='__dropdown']"),
      );
      const snapshot = canonicalWidgetSnapshot(root, kind, {
        value: mounted.form.f.f.value(),
        portalRoots,
      });
      assert.deepEqual(
        compareToCanonical(snapshot, expectation),
        KNOWN_DIVERGENCES[kind] ?? [],
      );
    } finally {
      mounted.dispose();
      host.remove();
    }
  });
}
