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
  MDY_CANONICAL_AT_REST,
  MDY_CANONICAL_INVALID,
  type MdyCanonicalExpectation,
} from "@modyra/widgets/testing";
import { mountStateFixture } from "./catalog-host.spec";

/**
 * Divergences this renderer is allowed, each with the reason it is not a defect — or, where it is
 * one, recorded until its own batch fixes it. Asserted both ways: a new divergence fails, and so
 * does an entry left behind after its fix.
 *
 * **Three kinds render an error list that reaches nobody.** `radio`, `multiselect` and `colors`
 * carry no `aria-describedby` at all in the state where there is finally something to describe, so
 * the error is on screen, styled, and announced to no assistive technology. `radio` and `colors`
 * additionally never expose `aria-invalid`, so the field does not say it is wrong either.
 *
 * The other two renderers reach the list on all seventeen kinds, which is what makes these defects
 * rather than a permitted difference. Recorded rather than fixed: it is this adapter's projection to
 * repair, in a batch that can check the fix against every kind at once instead of the three that
 * happened to be measured here.
 */
const KNOWN_DIVERGENCES: Record<string, Partial<Record<MdyWidgetKind, string[]>>> = {
  invalid: {
    radio: [
      "group aria-describedby names nothing, expected errors",
      "state is [touched], expected [invalid, touched]",
    ],
    multiselect: ["searchButton aria-describedby names nothing, expected errors"],
    colors: [
      "control aria-describedby names nothing, expected errors",
      "state is [touched], expected [invalid, touched]",
    ],
  },
};

/**
 * At rest, no validator has run: nothing has been decided about the field before the user reached
 * it. Invalid is driven, because a state nobody drove into is a state the widget was never in.
 */
const STATES: ReadonlyArray<{
  readonly name: string;
  readonly expectations: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>>;
  readonly validators: boolean;
  readonly drive: string | null;
}> = [
  { name: "at rest", expectations: MDY_CANONICAL_AT_REST, validators: false, drive: null },
  { name: "invalid", expectations: MDY_CANONICAL_INVALID, validators: true, drive: "invalid" },
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
          portalRoots: fixture.portalRoots?.() ?? [],
        });

        expect(compareToCanonical(snapshot, state.expectations[kind as MdyWidgetKind]!))
          .toEqual(KNOWN_DIVERGENCES[name]?.[kind as MdyWidgetKind] ?? []);
        fixture.dispose();
      },
    );
  },
);
