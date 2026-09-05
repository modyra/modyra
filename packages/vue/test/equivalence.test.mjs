/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * The expectation lives in `@modyra/widgets/testing`, declared once. This file only mounts the
 * component, drives it, and hands over the root — an expectation written here would be one of four
 * that happen to agree today.
 *
 * The mounting is `support/state-fixture.mjs`, published in the shape `MdyStateFixture` declares, so
 * "the same actions" means the same actions wherever the suite runs.
 *
 * **The divergences below are recorded, not accepted.** This renderer was measured against the canon
 * after the others, and a suite that arrived with everything green would be a suite that was not
 * asking. Each entry is a defect with a claim and a severity, repaired in its own batch, and
 * an entry left behind after its repair fails here exactly as a new divergence does.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
const {
  canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AFTER_ESCAPE,
  MDY_CANONICAL_AT_REST, MDY_CANONICAL_DISABLED, MDY_CANONICAL_FILLED_OBSERVATION,
  MDY_CANONICAL_INVALID, MDY_CANONICAL_OPEN, inspectCalendarWeekStart,
} = await import("../../widgets/dist/testing/index.js");
const { mount } = await import("./support/state-fixture.mjs");

/**
 * Divergences this renderer is allowed, each with the reason it is not a defect — or, where it is
 * one, recorded until its own batch fixes it. Asserted both ways: a new divergence fails, and so
 * does an entry left behind after its fix.
 *
 * Filled in from the first run of this suite, which is the point of writing it.
 */
/** What a calendar that never asks the locale renders instead. */
const WEEK_START_IGNORED = [{
  code: "CALENDAR_WEEK_START_IGNORES_LOCALE",
  detail: "it-IT starts its week on L: expected L M M G V S D, rendered S M T W T F S",
}];

/** The kinds whose two whole-renderer divergences below cover every one of them. */
const KINDS_INVALID = Object.keys(MDY_CANONICAL_AT_REST);

const KNOWN_DIVERGENCES = {
  /**
   * Every kind, one cause: this renderer reflects `invalid` and not `touched`. The canon asks for
   * both because a field that is invalid *and* untouched is a different thing to look at — it is a
   * verdict nobody has been shown yet — and a renderer that cannot say the difference cannot style
   * it either.
   *
   * Two kinds carry a second, unrelated one: their control points `aria-describedby` at the
   * supporting text where the canon names the error list, so a reader hears the hint and not the
   * reason the field was rejected.
   */
  invalid: Object.fromEntries(KINDS_INVALID.map((kind) => [kind, [
    ...(kind === "select" ? ["trigger aria-describedby names supportingText, expected errors"] : []),
    ...(kind === "colors" ? ["hexInput aria-describedby names supportingText, expected errors"] : []),
    "state is [invalid], expected [invalid, touched]",
  ]])),

  /**
   * Every kind, one cause: disabling a field moves focus onto the widget's own root, which this
   * renderer makes focusable with `tabindex="-1"` to receive it. The canon expects focus to rest
   * nowhere — a container is not somewhere a person can be.
   */
  disabled: Object.fromEntries(KINDS_INVALID.map((kind) => [kind, ["focus rests on root, expected nothing"]])),

  /** A part the contract does not declare for this kind, drawn while the panel is up. */
  open: { timepicker: ["extra part: periodOption"] },

  /** Likewise, on a multiselect holding a value. */
  filled: { multiselect: ["extra part: chipMove"] },

  /**
   * After Escape: the same missing `touched`, and focus left nowhere instead of back on the control
   * the person was standing on. The second is the one that is felt — dismissing a panel from the
   * keyboard and finding focus on the document is how a person loses their place in a form.
   */
  /**
   * The calendar's weekday row is written in English and begins on Sunday whatever the locale — so
   * `en-US` is right by coincidence and every other locale is wrong. The other renderers read the
   * same environment and answer it, so this is not a missing input: this one never asks.
   */
  "week start": { "it-IT": { datepicker: WEEK_START_IGNORED, daterange: WEEK_START_IGNORED } },

  "after escape": Object.fromEntries(
    ["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"].map((kind) => [kind, [
      "state is [], expected [touched]",
      "focus rests on nothing, expected somewhere in the widget",
    ]]),
  ),
};

/**
 * At rest, no validator has run: nothing has been decided about the field before the user reached
 * it. Every other state is driven, because a state nobody drove into is a state the element was
 * never in — and each is measured on its own, so an element that got two of them wrong is not
 * reported once.
 */
const STATES = [
  { name: "at rest", expectations: MDY_CANONICAL_AT_REST, validators: false, drive: null },
  { name: "invalid", expectations: MDY_CANONICAL_INVALID, validators: true, drive: "invalid" },
  { name: "disabled", expectations: MDY_CANONICAL_DISABLED, validators: false, drive: "disabled" },
  { name: "open", expectations: MDY_CANONICAL_OPEN, validators: false, drive: "open" },
  // The roadmap's *programmatic update*: a value the form put there, not one the user typed.
  { name: "filled", expectations: MDY_CANONICAL_FILLED_OBSERVATION, validators: false, drive: "filled" },
];

for (const { name, expectations, validators, drive } of STATES) {
  for (const [kind, expectation] of Object.entries(expectations)) {
    test(`${kind} produces the canonical observation ${name}`, async () => {
      const fixture = await mount(kind, { validators });
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
 * The first check here about what an element *does* rather than what it looks like in a state it was
 * put into. The expectation is declared once in `@modyra/widgets/testing`, like every other, so the
 * three renderers answer the same question about the same sequence.
 */
for (const [kind, expectation] of Object.entries(MDY_CANONICAL_AFTER_ESCAPE)) {
  test(`${kind} returns to the opener when Escape dismisses it`, async () => {
    const fixture = await mount(kind, { validators: false });
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

/**
 * The roadmap's *reset*: a widget given a value and then returned to the one it started with must
 * look exactly as it did before it was ever touched.
 *
 * The one comparison that cannot be made from a single observation, because it is about two of them
 * being the same. A renderer that leaves a class, an attribute or a stale display value behind
 * passes every other check here — the state it is left in is legal, it is simply not the one it
 * started in.
 */
for (const [kind, expectation] of Object.entries(MDY_CANONICAL_AT_REST)) {
  test(`${kind} returns to its resting observation when reset`, async () => {
    const fixture = await mount(kind, { validators: false });
    await fixture.settle();
    const before = canonicalWidgetSnapshot(fixture.root, kind, { value: fixture.value() });

    try {
      assert.ok(fixture.drive("filled"), `${kind}: not fillable`);
      await fixture.settle();
      assert.ok(fixture.drive("empty"), `${kind}: not clearable`);
      await fixture.settle();

      const after = canonicalWidgetSnapshot(fixture.root, kind, { value: fixture.value() });
      assert.deepEqual(
        compareToCanonical(after, expectation),
        KNOWN_DIVERGENCES.reset?.[kind] ?? [],
        `${kind}: the reset observation differs from the resting one`,
      );
      assert.deepEqual(after.parts.map((p) => p.part).sort(), before.parts.map((p) => p.part).sort());
    } finally {
      fixture.dispose();
    }
  });
}

/**
 * A calendar begins its week where its user's locale does.
 *
 * Not part of the canonical snapshot, because the expectation depends on the locale rather than on
 * the contract alone. It belongs beside it: this is an observation two renderers can disagree on
 * while both produce a well-formed grid, which is the class of difference this milestone exists to
 * catch.
 *
 * Two locales, chosen because they start the week on different days. One locale proves nothing —
 * a renderer with the week start hardcoded is correct in exactly the locale whose value it
 * hardcoded, and a suite that only ever runs there is measuring its own environment.
 */
for (const locale of ["en-US", "it-IT"]) {
  for (const kind of ["datepicker", "daterange"]) {
    test(`${kind}: the week starts where ${locale} starts`, async () => {
      const original = navigator.language;
      Object.defineProperty(navigator, "language", { value: locale, configurable: true });
      try {
        const mounted = await mount(kind);
        await mounted.settle?.();
        await mounted.drive?.("open");
        await mounted.settle?.();

        // This renderer lifts its panel to the document, which the contract permits, so the calendar
        // is not under the widget's root. Reached through the part the catalogue names rather than by
        // scanning the page: a document with two date fields has two calendars, and the wrong one
        // answers just as confidently.
        const panel = mounted.parts().popup ?? mounted.root;
        const rendered = [...panel.querySelectorAll(".mdy-datepicker__weekday")].map((node) => node.textContent.trim());
        assert.ok(rendered.length > 0, `${kind}: no weekday headers were rendered, so nothing was compared`);
        assert.deepEqual(
          inspectCalendarWeekStart(rendered, locale),
          KNOWN_DIVERGENCES["week start"]?.[locale]?.[kind] ?? [],
        );

        mounted.dispose();
      } finally {
        Object.defineProperty(navigator, "language", { value: original, configurable: true });
      }
    });
  }
}
