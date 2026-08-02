/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * The expectation lives in `@modyra/widgets/testing`, declared once. This file only mounts the
 * widget and hands over the root — an expectation written here would be one of three that happen to
 * agree today, which is the failure mode Milestone C exists to prevent.
 *
 * The mounting is `mountStateFixture`, the same fixture the state matrix drives. The question this
 * suite asks about a state and the question that one asks are different; the widget they ask it of
 * must not be.
 */
import "@angular/compiler";
import type { MdyWidgetKind } from "@modyra/widgets";
import {
  canonicalWidgetSnapshot,
  compareToCanonical,
  MDY_CANONICAL_AFTER_ESCAPE,
  MDY_CANONICAL_AT_REST,
  MDY_CANONICAL_DISABLED,
  MDY_CANONICAL_FILLED_OBSERVATION,
  MDY_CANONICAL_INVALID,
  MDY_CANONICAL_OPEN,
  type MdyCanonicalExpectation,
} from "@modyra/widgets/testing";
import { mountStateFixture } from "./catalog-host.spec";

/**
 * Divergences this renderer is allowed, each with the reason it is not a defect — or, where it is
 * one, recorded until its own batch fixes it. Asserted both ways: a new divergence fails, and so
 * does an entry left behind after its fix.
 *
 * **`select`, `datepicker` and `daterange` leave focus on the document body when Escape dismisses
 * them.** The user is dropped at the top of the page with no way back to the field they were in.
 * Both other renderers return focus into the widget on every overlay kind, and this adapter's own
 * multiselect does too, so this is a defect rather than a permitted difference.
 *
 * Recorded rather than fixed here: these three close through the shared overlay panel, whose `close`
 * output is also emitted for a backdrop click. Restoring focus at that point would yank it away from
 * whatever the user clicked, which is a worse bug than the one being fixed, so the repair needs a
 * batch that can separate keyboard dismissal from pointer dismissal.
 *
 * The hand-written Escape test this suite replaced asserted only that `aria-expanded` became false,
 * which is why three kinds could strand the keyboard and stay green.
 */
const KNOWN_DIVERGENCES: Record<string, Partial<Record<MdyWidgetKind, string[]>>> = {};


/**
 * At rest, no validator has run: nothing has been decided about the field before the user reached
 * it. Every other state is driven, because a state nobody drove into is a state the widget was
 * never in — and each is measured on its own, so a renderer that got two of them wrong is not
 * reported once.
 */
const STATES: ReadonlyArray<{
  readonly name: string;
  readonly expectations: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>>;
  readonly validators: boolean;
  readonly drive: string | null;
}> = [
  { name: "at rest", expectations: MDY_CANONICAL_AT_REST, validators: false, drive: null },
  { name: "invalid", expectations: MDY_CANONICAL_INVALID, validators: true, drive: "invalid" },
  { name: "disabled", expectations: MDY_CANONICAL_DISABLED, validators: false, drive: "disabled" },
  { name: "open", expectations: MDY_CANONICAL_OPEN, validators: false, drive: "open" },
  // The roadmap's *programmatic update*: a value the form put there, not one the user typed.
  { name: "filled", expectations: MDY_CANONICAL_FILLED_OBSERVATION, validators: false, drive: "filled" },
];

describe.each(STATES.map((state) => [state.name, state] as const))(
  "Angular renderers, against the canonical observation %s",
  (name, state) => {
    it.each(Object.keys(state.expectations).map((kind) => [kind]))(
      "%s produces the canonical observation",
      async (kind) => {
        const fixture = mountStateFixture(kind as MdyWidgetKind, { validators: state.validators });
        if (state.drive) {
          expect(`${kind} drivable: ${fixture.drive(state.drive as never)}`).toBe(`${kind} drivable: true`);
        }
        await fixture.settle();

        const snapshot = canonicalWidgetSnapshot(fixture.root, kind as MdyWidgetKind, {
          value: fixture.value?.(),
        });

        expect(compareToCanonical(snapshot, state.expectations[kind as MdyWidgetKind]!))
          .toEqual(KNOWN_DIVERGENCES[name]?.[kind as MdyWidgetKind] ?? []);
        fixture.dispose();
      },
    );
  },
);

/**
 * The same gesture, executed by every renderer: open the overlay, then dismiss it from the keyboard.
 *
 * The first check here about what a widget *does* rather than what it looks like in a state it was
 * put into. The expectation is declared once in `@modyra/widgets/testing`, like every other, so the
 * three renderers answer the same question about the same sequence — this replaced a hand-written
 * Escape test that each adapter kept its own copy of.
 */
describe("Angular renderers, dismissing an overlay from the keyboard", () => {
  it.each(Object.keys(MDY_CANONICAL_AFTER_ESCAPE).map((kind) => [kind]))(
    "%s returns focus into the widget",
    async (kind) => {
      const fixture = mountStateFixture(kind as MdyWidgetKind, { validators: false });
      expect(`${kind} openable: ${fixture.drive("open")}`).toBe(`${kind} openable: true`);
      await fixture.settle();

      expect(compareToCanonical(
        canonicalWidgetSnapshot(fixture.root, kind as MdyWidgetKind, { value: fixture.value?.() }),
        MDY_CANONICAL_OPEN[kind as MdyWidgetKind]!,
      )).toEqual(KNOWN_DIVERGENCES.open?.[kind as MdyWidgetKind] ?? []);

      expect(`${kind} keyed: ${fixture.press?.("Escape")}`).toBe(`${kind} keyed: true`);
      await fixture.settle();

      expect(compareToCanonical(
        canonicalWidgetSnapshot(fixture.root, kind as MdyWidgetKind, { value: fixture.value?.() }),
        MDY_CANONICAL_AFTER_ESCAPE[kind as MdyWidgetKind]!,
      )).toEqual(KNOWN_DIVERGENCES["after escape"]?.[kind as MdyWidgetKind] ?? []);
      fixture.dispose();
    },
  );
});

/**
 * The roadmap's *reset*: a widget given a value and then returned to the one it started with must
 * look exactly as it did before it was ever touched.
 *
 * The one comparison that cannot be made from a single observation, because it is about two of them
 * being the same. A renderer that leaves a class, an attribute or a stale display value behind
 * passes every other check here — the state it is left in is legal, it is simply not the one it
 * started in.
 */
describe("Angular renderers, reset to where they started", () => {
  it.each(Object.keys(MDY_CANONICAL_AT_REST).map((kind) => [kind]))(
    "%s returns to its resting observation",
    async (kind) => {
      const fixture = mountStateFixture(kind as MdyWidgetKind, { validators: false });
      await fixture.settle();
      const before = canonicalWidgetSnapshot(fixture.root, kind as MdyWidgetKind, {
        value: fixture.value?.(),
      });

      expect(`${kind} fillable: ${fixture.drive("filled" as never)}`).toBe(`${kind} fillable: true`);
      await fixture.settle();
      expect(`${kind} clearable: ${fixture.drive("empty" as never)}`).toBe(`${kind} clearable: true`);
      await fixture.settle();

      const after = canonicalWidgetSnapshot(fixture.root, kind as MdyWidgetKind, {
        value: fixture.value?.(),
      });
      expect(compareToCanonical(after, MDY_CANONICAL_AT_REST[kind as MdyWidgetKind]!))
        .toEqual(KNOWN_DIVERGENCES["reset"]?.[kind as MdyWidgetKind] ?? []);
      expect(after.parts.map((p) => p.part).sort())
        .toEqual(before.parts.map((p) => p.part).sort());
      fixture.dispose();
    },
  );
});
