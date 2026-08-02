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
const {
  canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AFTER_ESCAPE,
  MDY_CANONICAL_AT_REST, MDY_CANONICAL_DISABLED, MDY_CANONICAL_INVALID, MDY_CANONICAL_OPEN,
} = await import("../../widgets/dist/testing/index.js");
const { mount } = await import("./support/state-fixture.mjs");

/**
 * Divergences this renderer is allowed, each with the reason it is not a defect.
 *
 * **Empty.** Every kind this renderer draws produces the canonical observation in all four states
 * and after the Escape sequence.
 */
const KNOWN_DIVERGENCES = {};

/**
 * At rest, no validator has run: nothing has been decided about the field before the user reached
 * it. Every other state is driven, because a state nobody drove into is a state the widget was
 * never in — and each is measured on its own, so a renderer that got two of them wrong is not
 * reported once.
 */
const STATES = [
  { name: "at rest", expectations: MDY_CANONICAL_AT_REST, validators: false, drive: null },
  { name: "invalid", expectations: MDY_CANONICAL_INVALID, validators: true, drive: "invalid" },
  { name: "disabled", expectations: MDY_CANONICAL_DISABLED, validators: false, drive: "disabled" },
  { name: "open", expectations: MDY_CANONICAL_OPEN, validators: false, drive: "open" },
];

for (const { name, expectations, validators, drive } of STATES) {
  for (const [kind, expectation] of Object.entries(expectations)) {
    test(`${kind} produces the canonical observation ${name}`, async () => {
      const fixture = mount(kind, { validators });
      if (drive) assert.ok(fixture.drive(drive), `${kind}: ${drive} is not drivable`);
      await fixture.settle();
      try {
        const snapshot = canonicalWidgetSnapshot(fixture.root, kind, { value: fixture.value() });
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

/**
 * The same gesture, executed by every renderer: open the overlay, then dismiss it from the keyboard.
 *
 * The first check here about what a widget *does* rather than what it looks like in a state it was
 * put into. The expectation is declared once in `@modyra/widgets/testing`, like every other, so the
 * three renderers answer the same question about the same sequence.
 */
for (const [kind, expectation] of Object.entries(MDY_CANONICAL_AFTER_ESCAPE)) {
  test(`${kind} returns to the opener when Escape dismisses it`, async () => {
    const fixture = mount(kind, { validators: false });
    assert.ok(fixture.drive("open"), `${kind}: not openable`);
    await fixture.settle();
    try {
      assert.deepEqual(
        compareToCanonical(
          canonicalWidgetSnapshot(fixture.root, kind, { value: fixture.value() }),
          MDY_CANONICAL_OPEN[kind],
        ),
        KNOWN_DIVERGENCES.open?.[kind] ?? [],
        `${kind}: the overlay did not open as expected`,
      );

      assert.ok(fixture.press("Escape"), `${kind}: nothing to send Escape to`);
      await fixture.settle();
      assert.deepEqual(
        compareToCanonical(
          canonicalWidgetSnapshot(fixture.root, kind, { value: fixture.value() }),
          expectation,
        ),
        KNOWN_DIVERGENCES["after escape"]?.[kind] ?? [],
      );
    } finally {
      fixture.dispose();
    }
  });
}
