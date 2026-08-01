/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * The expectation lives in `@modyra/widgets/testing`, declared once. This file only mounts the
 * element and hands over the root — an expectation written here would be one of three that happen to
 * agree today.
 *
 * The mounting is `support/state-fixture.mjs`, the same fixture the state matrix drives. The
 * question this suite asks about a state and the question that one asks are different; the element
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
    // At rest means at rest: no validator has run, so nothing has been decided about the field
    // before the user reached it.
    const fixture = await mount(kind, { validators: false });
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
