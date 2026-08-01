/**
 * Runtime DOM conformance for the Angular renderers.
 *
 * The static audits prove the renderers *reference* the contract; this mounts them and checks what
 * they actually rendered with the same `assertWidgetDomContract` the Lit and Plain suites use, so
 * all three adapters answer to one gate rather than three descriptions of one.
 *
 * The host and the part map are shared with `state-matrix.spec.ts` — see `catalog-host.spec.ts`.
 * Two resolvers for one DOM is how a suite ends up reporting the fixture as a renderer defect.
 */
import { TestBed } from "@angular/core/testing";
import { inspectWidgetDom } from "@modyra/widgets/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import { CATALOG_KINDS, CatalogHost, partsOf } from "./catalog-host.spec";

/**
 * Angular's remaining divergences from the contract, recorded rather than waived. The expectation
 * below matches this map exactly, so a new one fails the suite and a fixed one cannot linger.
 *
 * The thirteen `ARIA_DANGLING_REF:root` rows are gone (plan 28).
 *
 * They appeared the moment every control in the catalogue host became `mdyRequired` — before that
 * no field could have an error, so nothing pointed anywhere and nothing could dangle. Not an
 * artefact: thirteen renderers guarded the reference with `hasErrors()` and rendered the list it
 * named with `!inlineErrors && touched() && hasErrors()`, so an invalid untouched field described
 * itself by an element that did not exist. One predicate, `describedById`, now answers both.
 *
 * What remains below is unchanged, and none of it is an ARIA reference.
 */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {
  // The trigger exists — the fixture is `searchable`, so the custom trigger behind
  // `@if (optionTpl() || searchable())` is rendered — but it does not sit inside the element the
  // contract calls its owner. Whether a native `<select>` may satisfy `trigger` at all remains a
  // renderer-equivalence question; this is the narrower one of where the part lives, and it is the
  // same question as `datepicker`/`timepicker` below.
  select: ["PART_NOT_OWNED:trigger"],
  // The chips wrapper precedes the input wrapper in Angular and follows it in Plain, and the label
  // points at an id no element in this fixture carries.
  multiselect: ["PART_ORDER:inputWrapper", "ARIA_DANGLING_REF:label"],
  // `nativePicker` was declared a <label> in task 06, from Plain, which wraps the hidden colour
  // input in one. Angular does not, and its `control` sits outside the picker as a result.
  colors: ["PART_ELEMENT:nativePicker", "PART_NOT_CONTAINED:control", "PART_NOT_OWNED:toggle"],
  // F-08 is closed centrally — the a11y projections now declare `aria-controls`, and Plain is clean.
  // Angular remains divergent for a different reason, and it is a *placement* question rather than a
  // missing relation: Angular puts `aria-expanded` on the toggle button beside the input, while the
  // shared projection puts the whole combobox relation on the input itself. Making them agree means
  // deciding which element owns the expanded state and giving the CDK panel an id the opener can
  // name — a renderer-equivalence decision, so it belongs to task 16 rather than to a defect batch.
  datepicker: ["PART_NOT_OWNED:control"],
  timepicker: ["PART_NOT_OWNED:control"],
  // Same placement question; Angular's daterange toggle carries the state and names no popup.
  daterange: ["PART_NOT_OWNED:toggle"],
};

describe("Angular renderers, against the widget DOM contract", () => {
  it.each(CATALOG_KINDS.map(({ kind, selector }) => [kind, selector]))(
    "%s conforms",
    (kind, selector) => {
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(selector as string) as Element;
      expect(root).toBeTruthy();

      const issues = inspectWidgetDom(root, kind as MdyWidgetKind, {
        parts: partsOf(root, kind as MdyWidgetKind),
      });
      expect(issues.map((issue) => `${issue.code}:${issue.part}`))
        .toEqual(KNOWN_DIVERGENCES[kind as MdyWidgetKind] ?? []);
    },
  );
});
