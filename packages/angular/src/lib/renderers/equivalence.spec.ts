/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * The expectation lives in `@modyra/widgets/testing`, declared once. This file only mounts the
 * widget and hands over the root — an expectation written here would be one of three that happen to
 * agree today, which is the failure mode Milestone C exists to prevent.
 */
import "@angular/compiler";
import { TestBed } from "@angular/core/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import {
  canonicalWidgetSnapshot,
  compareToCanonical,
  MDY_CANONICAL_AT_REST,
} from "@modyra/widgets/testing";
import { CATALOG_KINDS, CatalogHost } from "./catalog-host.spec";

/** Divergences this renderer is allowed, each with the reason it is not a defect. */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {};

describe("Angular renderers, against the canonical observation", () => {
  it.each(Object.keys(MDY_CANONICAL_AT_REST).map((kind) => [kind]))(
    "%s produces the canonical observation at rest",
    (kind) => {
      const entry = CATALOG_KINDS.find((candidate) => candidate.kind === kind)!;
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(entry.selector) as Element;

      const snapshot = canonicalWidgetSnapshot(root, kind as MdyWidgetKind, {
        value: fixture.componentInstance.adapter.getField(entry.name)?.().value(),
      });

      expect(compareToCanonical(snapshot, MDY_CANONICAL_AT_REST[kind as MdyWidgetKind]!))
        .toEqual(KNOWN_DIVERGENCES[kind as MdyWidgetKind] ?? []);
    },
  );
});
