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

/**
 * Classes these renderers use that the widget contract does not declare.
 *
 * Enumerated rather than waived, so a class added tomorrow fails until it is either declared by the
 * contract or added here deliberately. Three groups sit in the list and want different answers:
 * adapter-internal hooks the contract has no opinion on, classes the widget's own runtime
 * projections emit but the static catalogue never lists, and structural classes the themes style
 * that the catalogue has simply never described.
 */
const UNDECLARED_CLASSES = [
  "mdy-button",
  "mdy-chip--centered",
  "mdy-colors",
  "mdy-colors__dropdown-header",
  "mdy-datepicker",
  "mdy-datepicker__calendar",
  "mdy-datepicker__header",
  "mdy-datepicker__header-label",
  "mdy-datepicker__header-nav",
  "mdy-datepicker__icon",
  "mdy-datepicker__nav-btn",
  "mdy-datepicker__title",
  "mdy-datepicker__view-icon",
  "mdy-datepicker__view-toggle",
  "mdy-daterange__group",
  "mdy-daterange__hint",
  "mdy-daterange__input-sizer",
  "mdy-file-icon",
  "mdy-file-info",
  "mdy-file-placeholder",
  "mdy-glass-effect",
  "mdy-glass-effect--medium",
  "mdy-overlay",
  "mdy-overlay-panel",
  "mdy-segmented__button--first",
  "mdy-segmented__button--last",
  "mdy-select",
  "mdy-select__arrow",
  "mdy-select__option-label",
  "mdy-timepicker",
  "mdy-timepicker--dial",
  "mdy-timepicker-dial-variant",
  "mdy-timepicker-fields",
  "mdy-timepicker-period-btn",
  "mdy-timepicker-period-btn--selected",
  "mdy-timepicker-segment-input",
  "mdy-timepicker-segment-input--readonly",
  "mdy-timepicker-separator",
  "mdy-timepicker-spacer",
  "mdy-timepicker__icon",
];

const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {
  // The chips wrapper precedes the input wrapper in Angular and follows it in Plain, and the label
  // points at an id no element in this fixture carries.
  multiselect: ["PART_ORDER:inputWrapper", "ARIA_DANGLING_REF:label"],
  // `nativePicker` was declared a <label> in task 06, from Plain, which wraps the hidden colour
  // input in one. Angular does not, and its `control` sits outside the picker as a result.
  colors: ["PART_ELEMENT:nativePicker", "PART_NOT_CONTAINED:control"],
  // F-08 is closed centrally — the a11y projections now declare `aria-controls`, and Plain is clean.
  // Angular remains divergent for a different reason, and it is a *placement* question rather than a
  // missing relation: Angular puts `aria-expanded` on the toggle button beside the input, while the
  // shared projection puts the whole combobox relation on the input itself. Making them agree means
  // deciding which element owns the expanded state and giving the CDK panel an id the opener can
  // name — a renderer-equivalence decision, so it belongs to task 16 rather than to a defect batch.
  datepicker: ["PART_NOT_OWNED:control"],
  timepicker: ["PART_NOT_OWNED:control"],

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
        // The class vocabulary is contract data: a theme can only style what it can enumerate.
        strictClasses: true,
        allowedClasses: UNDECLARED_CLASSES,
      });
      expect(issues.map((issue) => `${issue.code}:${issue.part}`))
        .toEqual(KNOWN_DIVERGENCES[kind as MdyWidgetKind] ?? []);
    },
  );
});
