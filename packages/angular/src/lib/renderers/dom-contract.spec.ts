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
 */
/**
 * `ARIA_DANGLING_REF:root` — one defect, thirteen appearances, and it is **not** a fixture artefact.
 *
 * It appeared the moment every control in the catalogue host became `mdyRequired`. Before that no
 * field could ever have an error, so nothing pointed anywhere and the reference could not dangle.
 *
 * Twelve renderers guard the reference with `hasErrors()`:
 *
 *     [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
 *
 * and render the list it names with a *different* predicate:
 *
 *     @if (!inlineErrors && touched() && hasErrors()) { <mdy-error-list ... /> }
 *
 * They disagree on two axes. An invalid but untouched field — which is the resting state of every
 * required field on page load — describes itself by an element that does not exist, and so does any
 * field using inline errors. `colors` guards with `touched() && hasErrors()` and still ignores
 * `inlineErrors`; the text kinds escape only because they emit no reference at all unless inline
 * errors are on, which is its own gap rather than a fix.
 *
 * Plain cannot have this: it always renders the error `<ul>`, so the id it names always resolves.
 *
 * Recorded rather than fixed — this batch widened the test surface and repairing thirteen renderer
 * templates inside it would be the open-ended sweep the plan set out to avoid. It is plan **28**.
 */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {
  textarea: ["ARIA_DANGLING_REF:root"],
  number: ["ARIA_DANGLING_REF:root"],
  checkbox: ["ARIA_DANGLING_REF:root"],
  toggle: ["ARIA_DANGLING_REF:root"],
  slider: ["ARIA_DANGLING_REF:root"],
  file: ["ARIA_DANGLING_REF:root"],
  // Twice: the radio group names the list on the group and again on an option.
  radio: ["ARIA_DANGLING_REF:root", "ARIA_DANGLING_REF:root"],
  // Angular's select renders a native <select> unless an option template or search is supplied —
  // the custom trigger sits behind `@if (optionTpl() || searchable())`. The contract makes `trigger`
  // required, so in its native mode Angular has no element to offer. Either the contract must let a
  // native <select> satisfy `trigger`, or the renderer must always emit one. That is a
  // renderer-equivalence decision, not a fixture bug: Plain always renders a trigger.
  select: ["PART_MISSING:trigger", "ARIA_DANGLING_REF:root"],
  // The chips wrapper precedes the input wrapper in Angular and follows it in Plain, and the label
  // points at an id no element in this fixture carries.
  multiselect: ["PART_ORDER:inputWrapper", "ARIA_DANGLING_REF:root", "ARIA_DANGLING_REF:label"],
  // `nativePicker` was declared a <label> in task 06, from Plain, which wraps the hidden colour
  // input in one. Angular does not, and its `control` sits outside the picker as a result.
  // No dangling reference here: colors is the one renderer that guards on `touched()`.
  colors: ["PART_ELEMENT:nativePicker", "PART_NOT_CONTAINED:control", "PART_NOT_OWNED:toggle"],
  // F-08 is closed centrally — the a11y projections now declare `aria-controls`, and Plain is clean.
  // Angular remains divergent for a different reason, and it is a *placement* question rather than a
  // missing relation: Angular puts `aria-expanded` on the toggle button beside the input, while the
  // shared projection puts the whole combobox relation on the input itself. Making them agree means
  // deciding which element owns the expanded state and giving the CDK panel an id the opener can
  // name — a renderer-equivalence decision, so it belongs to task 16 rather than to a defect batch.
  datepicker: ["ARIA_DANGLING_REF:root", "PART_NOT_OWNED:control"],
  timepicker: ["ARIA_DANGLING_REF:root", "PART_NOT_OWNED:control"],
  // Same placement question; Angular's daterange toggle carries the state and names no popup.
  // Twice over, because both endpoints describe themselves by the same absent list.
  daterange: ["ARIA_DANGLING_REF:root", "ARIA_DANGLING_REF:root", "PART_NOT_OWNED:toggle"],
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
