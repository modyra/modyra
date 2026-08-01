/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * Milestone C's question is whether three renderers given the same schema and the same actions
 * produce the same observation. The expectation lives in `@modyra/widgets/testing`, declared once —
 * an expectation written here would be one of three that happen to agree today. This file only
 * mounts the widget, drives it, and hands over the root.
 *
 * The mounting is `support/state-fixture.mjs`, the same fixture the state matrix drives. The
 * question this suite asks about a state and the question that one asks are different; the widget
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
 * **`datepicker` and `timepicker` never reflect `touched`.** Their renderers do not call the field
 * shell's `syncState`, so the root carries no `mdy-renderer--touched` and the wrapper no error
 * modifier — the treatments three themes key off. Every other kind here either calls it or sets the
 * class directly. A rendering defect, recorded rather than fixed: it is this renderer's to fix, in
 * a batch that can verify the themes still key off what they used to.
 */
const KNOWN_DIVERGENCES = {
  invalid: {
    datepicker: ["state is [invalid], expected [invalid, touched]"],
    timepicker: ["state is [invalid], expected [invalid, touched]"],
  },
};

/**
 * At rest, no validator has run: nothing has been decided about the field before the user reached
 * it. Invalid is driven, because a state nobody drove into is a state the widget was never in.
 */
const STATES = [
  { name: "at rest", expectations: MDY_CANONICAL_AT_REST, validators: false, drive: null },
  { name: "invalid", expectations: MDY_CANONICAL_INVALID, validators: true, drive: "invalid" },
];

for (const { name, expectations, validators, drive } of STATES) {
  for (const [kind, expectation] of Object.entries(expectations)) {
    test(`${kind} produces the canonical observation ${name}`, async () => {
      const fixture = mount(kind, { validators });
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
