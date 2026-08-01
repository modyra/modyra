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
} from "@modyra/widgets/testing";
import { mountStateFixture } from "./catalog-host.spec";

/** Divergences this renderer is allowed, each with the reason it is not a defect. */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {};

describe("Angular renderers, against the canonical observation", () => {
  it.each(Object.keys(MDY_CANONICAL_AT_REST).map((kind) => [kind]))(
    "%s produces the canonical observation at rest",
    async (kind) => {
      // At rest means at rest: no validator has run, so nothing has been decided about the field
      // before the user reached it.
      const fixture = mountStateFixture(kind as MdyWidgetKind, { validators: false });
      await fixture.settle();

      const snapshot = canonicalWidgetSnapshot(fixture.root, kind as MdyWidgetKind, {
        value: fixture.value?.(),
        portalRoots: fixture.portalRoots?.() ?? [],
      });

      expect(compareToCanonical(snapshot, MDY_CANONICAL_AT_REST[kind as MdyWidgetKind]!))
        .toEqual(KNOWN_DIVERGENCES[kind as MdyWidgetKind] ?? []);
      fixture.dispose();
    },
  );
});
