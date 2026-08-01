/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * The expectation lives in `@modyra/widgets/testing`, declared once. This file only mounts the
 * element, drives it, and hands over the root — an expectation written here would be one of three
 * that happen to agree today.
 *
 * The mounting is `support/state-fixture.mjs`, the same fixture the state matrix drives. The
 * question this suite asks about a state and the question that one asks are different; the element
 * they ask it of must not be.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AT_REST, MDY_CANONICAL_INVALID } =
  await import("../../widgets/dist/testing/index.js");
const { mount } = await import("./support/state-fixture.mjs");

/**
 * Divergences this renderer is allowed, each with the reason it is not a defect — or, where it is
 * one, recorded until its own batch fixes it. Asserted both ways: a new divergence fails, and so
 * does an entry left behind after its fix.
 *
 * Empty: every kind this renderer draws produces the canonical observation in both states.
 */
const KNOWN_DIVERGENCES = {};

/**
 * At rest, no validator has run: nothing has been decided about the field before the user reached
 * it. Invalid is driven, because a state nobody drove into is a state the element was never in.
 */
const STATES = [
  { name: "at rest", expectations: MDY_CANONICAL_AT_REST, validators: false, drive: null },
  { name: "invalid", expectations: MDY_CANONICAL_INVALID, validators: true, drive: "invalid" },
];

for (const { name, expectations, validators, drive } of STATES) {
  for (const [kind, expectation] of Object.entries(expectations)) {
    test(`${kind} produces the canonical observation ${name}`, async () => {
      const fixture = await mount(kind, { validators });
      if (drive) assert.ok(fixture.drive(drive), `${kind}: ${drive} is not drivable`);
      await fixture.settle();
      try {
        const snapshot = canonicalWidgetSnapshot(fixture.root, kind, {
          value: fixture.value(),
          portalRoots: fixture.portalRoots(),
        });
        assert.deepEqual(
          compareToCanonical(snapshot, expectation),
          KNOWN_DIVERGENCES[name]?.[kind] ?? [],
        );
      } finally {
        fixture.dispose();
      }
    });
  }
}
