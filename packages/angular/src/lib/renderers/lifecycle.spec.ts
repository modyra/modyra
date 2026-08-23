/**
 * The whole life of a mounted control, not just its first frame.
 *
 * The conditions are `@modyra/widgets`'s. They were driven by one renderer, then two; this is the
 * third. A teardown obligation checked in one place and declared for all is the shape this
 * repository keeps finding — the inspector gained `EFFECT_THREW_AFTER_UNMOUNT` and had a single
 * consumer, so nothing said whether the other renderers owed it too.
 *
 * Angular destroys through its own lifecycle, which is the point: `DestroyRef.onDestroy` is a
 * different mechanism from an element's `disconnectedCallback` and from a returned closure, and the
 * three must produce the same document.
 */
import { TestBed } from "@angular/core/testing";
import {
  idsUnder,
  inspectCoexistence,
  inspectUnmount,
  MDY_LIFECYCLE_ISSUE,
} from "@modyra/widgets/testing";

import { CatalogHost } from "./catalog-host.spec";

/** Where an overlay is lifted out of the control, so a teardown has somewhere to leave something. */
const PORTAL_OPENERS = [
  ".mdy-select__trigger",
  ".mdy-datepicker__toggle",
  ".mdy-timepicker__toggle",
  ".mdy-colors__toggle-area",
  ".mdy-multiselect__trigger",
];

/** What the reactive runtime said while `run` executed — where a surviving effect announces itself. */
function errorsDuring(run: () => void): readonly string[] {
  const raised: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { raised.push(args.map(String).join(" ")); };
  try { run(); } finally { console.error = original; }
  return raised;
}

describe("the lifecycle contract, driven against this renderer", () => {
  it("mount, then destroy, gives the document back exactly", () => {
    /**
     * Warm the application-scoped singletons before measuring.
     *
     * The ARIA live region is created on first use and deliberately outlives every widget: a message
     * announced as a control closes must still be read after it has gone. Counted from zero it looks
     * exactly like a leak, and a check that cannot tell "supposed to survive" from "survived" reports
     * the wrong one. Everything created from here on is per-instance and owed back.
     */
    const warmup = TestBed.createComponent(CatalogHost);
    warmup.detectChanges();
    warmup.destroy();
    (warmup.nativeElement as Element).remove();

    const before = document.body.querySelectorAll("*").length;
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();

    // Opened first: a popup that was never shown was never portalled, and the teardown of a portal
    // is the half destroying the component's own subtree cannot do.
    for (const opener of PORTAL_OPENERS) {
      const trigger = fixture.nativeElement.querySelector(opener) as HTMLElement | null;
      trigger?.click();
      fixture.detectChanges();
    }

    const idsWhileMounted = idsUnder(document.body);
    expect(idsWhileMounted.size).toBeGreaterThan(0);

    // Written through the engine rather than the handle: the question is whether anything still
    // reacts, and a destroyed host's handle is exactly what a caller would no longer be holding.
    const adapter = fixture.componentInstance.adapter;
    fixture.destroy();
    // The host element belongs to the test harness, not to the component: TestBed created it and
    // TestBed removes it. Every renderer's suite gives its own host back the same way, and leaving
    // it would measure the harness rather than the teardown.
    (fixture.nativeElement as Element).remove();

    let raised: readonly string[] = [];
    const issues = inspectUnmount({
      document,
      idsWhileMounted,
      elementsBeforeMount: before,
      pokeAfterDispose: () => {
        raised = errorsDuring(() => { adapter.patchValue({ text: "after" }); });
      },
      errorsAfterDispose: () => raised,
    });

    expect(issues.map((i) => `${i.code} — ${i.detail}`)).toEqual([]);
  });

  it("two live hosts do not mint the same id", () => {
    const first = TestBed.createComponent(CatalogHost);
    const second = TestBed.createComponent(CatalogHost);
    first.detectChanges();
    second.detectChanges();

    const issues = inspectCoexistence(
      idsUnder(first.nativeElement as Element),
      idsUnder(second.nativeElement as Element),
    );

    // `every` over an empty list is true, so this said nothing whichever way the renderer behaved —
    // and it would have gone on saying nothing after ADR 0146 changed the answer underneath it. What
    // is asserted is the count first and the kind second.
    //
    // Two hosts of one template, in one document, with no scope: this renderer computes an id while
    // rendering, before its element is in a document, so it has nothing to compare against and the
    // twin case is the consumer's to answer. ADR 0146 says so in as many words, and the collision
    // being *named* is what keeps it from passing unnoticed. The scoped half — two hosts told apart
    // publish disjoint ids — is asserted by the conformance kit's multi-instance section, which
    // mounts through this package's own `mountScoped`.
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.code === MDY_LIFECYCLE_ISSUE.idCollidedAcrossInstances)).toBe(true);

    first.destroy();
    second.destroy();
  });

});
