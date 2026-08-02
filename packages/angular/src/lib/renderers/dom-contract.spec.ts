/**
 * Runtime DOM conformance for the Angular renderers.
 *
 * The static audits prove the renderers *reference* the contract; this mounts them and checks what
 * they actually rendered with the same `assertWidgetDomContract` every adapter's suite uses, so
 * all three adapters answer to one gate rather than three descriptions of one.
 *
 * The host and the part map are shared with `state-matrix.spec.ts` — see `catalog-host.spec.ts`.
 * Two resolvers for one DOM is how a suite ends up reporting the fixture as a renderer defect.
 */
import { TestBed } from "@angular/core/testing";
import { inspectWidgetDom } from "@modyra/widgets/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
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
 * Angular's divergences from the DOM contract: none.
 *
 * Asserted in both directions, so a new divergence fails here and so does an entry left behind after
 * its fix.
 */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {};

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
      });
      expect(issues.map((issue) => `${issue.code}:${issue.part}`))
        .toEqual(KNOWN_DIVERGENCES[kind as MdyWidgetKind] ?? []);
    },
  );
});

/**
 * The DOM contract, with the overlay open.
 *
 * At rest an overlay widget renders none of its popup, so the listbox and its options, the calendar
 * grid and its cells, the clock face had their classes, parents, order, semantics and cardinality
 * checked nowhere. `overlayOnlyParts` names them, which is what makes this suite's scope a
 * measurement rather than a guess.
 */
const OPENER = ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
  + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn";

/** Parts that stay absent even with the overlay open. A state, not a waiver: `absentParts` asserts
 * they really are absent, so a renderer showing a no-results note over a populated list still fails. */
const ABSENT_WHILE_OPEN: Partial<Record<MdyWidgetKind, string[]>> = {
  select: ["empty", "loading"],
  multiselect: ["empty", "loading", "chips", "chip", "optionStep", "optionCount"],
  datepicker: ["actions"],
  daterange: ["actions"],
};

const OVERLAY_KINDS = CATALOG_KINDS.filter(
  ({ kind }) => MDY_WIDGET_CONTRACTS[kind].capabilities.overlay,
);

describe("Angular renderers, with the overlay open", () => {
  it("covers every overlay kind the catalogue declares", () => {
    expect(OVERLAY_KINDS.length).toBe(6);
  });

  it.each(OVERLAY_KINDS.map(({ kind, selector }) => [kind, selector]))(
    "%s conforms while it is open",
    (kind, selector) => {
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(selector as string) as Element;

      const affordance = root.querySelector(OPENER) as HTMLElement | null;
      expect(`${kind} has an opener: ${!!affordance}`).toBe(`${kind} has an opener: true`);
      affordance!.click();
      fixture.detectChanges();

      // The element carrying the relation is the part the contract names, which is not always the
      // one a pointer lands on: a datepicker's opener is its typeable control.
      const parts = partsOf(root, kind as MdyWidgetKind);
      const declaredOpener = parts[MDY_POPUP_OPENERS[kind as MdyWidgetKind]!.opener] as Element | null;
      expect(`${kind} opened: ${declaredOpener?.getAttribute("aria-expanded")}`)
        .toBe(`${kind} opened: true`);

      const issues = inspectWidgetDom(root, kind as MdyWidgetKind, {
        parts,
        absentParts: ABSENT_WHILE_OPEN[kind as MdyWidgetKind] ?? [],
        strictClasses: true,
        // The overlay is showing, so the parts that only exist inside it are required of this run.
        open: true,
      });
      expect(issues.map((issue) => `${issue.code}:${issue.part} — ${issue.message}`)).toEqual([]);
    },
  );
});
