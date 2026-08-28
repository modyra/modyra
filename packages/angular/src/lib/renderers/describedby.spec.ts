/**
 * `aria-describedby` names an element that exists.
 *
 * Thirteen renderers pointed the reference at the error list on `hasErrors()` and rendered that list
 * on `!inlineErrors && touched() && hasErrors()`. The predicates disagreed on two axes, so an
 * invalid but **untouched** field — the resting state of every required field on page load —
 * described itself by an element that was not in the DOM, and so did every field using inline
 * errors. The text kinds had the inverse defect: they emitted no reference at all.
 *
 * `dom-contract.spec.ts` proves the reference does not dangle. That is necessary and not sufficient:
 * emitting nothing also never dangles, which is exactly how the text kinds passed while announcing
 * no errors to anybody. So this follows the reference to the element it names and reads the text,
 * which is the check that found this class of bug in Plain.
 */
import { TestBed } from "@angular/core/testing";
import { CATALOG_KINDS, CatalogHost } from "./catalog-host.spec";

/** The element `aria-describedby` points at, and what a screen reader would read from it. */
function described(root: Element): { ref: string | null; text: string | null } {
  const source = root.querySelector("[aria-describedby]");
  const ref = source?.getAttribute("aria-describedby") ?? null;
  if (!ref) return { ref: null, text: null };
  const target = root.ownerDocument?.getElementById(ref) ?? null;
  return { ref, text: target ? (target.textContent ?? "").trim() : null };
}

describe("aria-describedby", () => {
  it("names an element that exists while the field is invalid but untouched", () => {
    // Every control in the host is `mdyRequired` and starts empty, so every field is invalid from
    // the first render — and none has been touched, so no message is shown yet. This is the state
    // the whole defect lived in.
    //
    // It used to assert the reference was absent, which was how the property below was satisfied
    // when the error container appeared with the first message. The container is now reserved under
    // any field that can fail a rule, so the reference is present from the start and resolves — and
    // an element with no text contributes nothing to a description, so a reader hears the same
    // nothing it heard before. The property was never "says nothing": it was "names something real".
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();

    for (const { kind, selector } of CATALOG_KINDS) {
      const root = fixture.nativeElement.querySelector(selector) as Element;
      const { ref } = described(root);
      if (ref === null) continue;
      for (const id of ref.split(" ")) {
        expect(`${kind}: ${id} resolves: ${Boolean(root.ownerDocument?.getElementById(id))}`)
          .toBe(`${kind}: ${id} resolves: true`);
      }
    }
  });

  it("names the error list, and the list holds the message, once the field is touched", () => {
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();
    const adapter = fixture.componentInstance.adapter;

    // The kinds whose control carries the reference. The composites route it through a trigger or
    // put it on a group, and their placement is a task-16 question; this asserts the shape that is
    // settled rather than pre-empting that decision.
    const CARRIERS = ["text", "textarea", "number", "email", "password", "checkbox", "toggle"];

    for (const { kind, selector, name } of CATALOG_KINDS) {
      if (!CARRIERS.includes(kind)) continue;
      adapter.getField(name)?.().touched.set(true);
      fixture.detectChanges();

      const root = fixture.nativeElement.querySelector(selector) as Element;
      const { ref, text } = described(root);

      expect(`${kind} ref`).toBe(ref ? `${kind} ref` : `${kind} ref MISSING`);
      // Resolving is not enough — the element must actually hold the error text. A reference to an
      // empty container announces nothing and passes a presence check.
      expect(`${kind}: ${text}`).toBe(`${kind}: This field is required`);
    }
  });
});
