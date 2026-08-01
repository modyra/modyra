/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * Milestone C's question is whether three renderers given the same schema and the same actions
 * produce the same observation. The expectation lives in `@modyra/widgets/testing`, declared once —
 * an expectation written here would be one of three that happen to agree today. This file only
 * mounts the widget and hands over the root.
 *
 * The mounting is `support/state-fixture.mjs`, the same fixture the state matrix drives. The
 * question this suite asks about a state and the question that one asks are different; the widget
 * they ask it of must not be.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AT_REST } =
  await import("../../widgets/dist/testing/index.js");
const { mount } = await import("./support/state-fixture.mjs");

/** Divergences this renderer is allowed, each with the reason it is not a defect. */
const KNOWN_DIVERGENCES = {};

for (const [kind, expectation] of Object.entries(MDY_CANONICAL_AT_REST)) {
  test(`${kind} produces the canonical observation at rest`, async () => {
    const fixture = mount(kind);
    await fixture.settle();
    try {
      const snapshot = canonicalWidgetSnapshot(fixture.root, kind, {
        value: fixture.value(),
        portalRoots: fixture.portalRoots(),
      });
      assert.deepEqual(
        compareToCanonical(snapshot, expectation),
        KNOWN_DIVERGENCES[kind] ?? [],
      );
    } finally {
      fixture.dispose();
    }
  });
}
