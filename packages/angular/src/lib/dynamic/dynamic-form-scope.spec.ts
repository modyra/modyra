/**
 * Two forms of one document on one page, and whose help text each field reads.
 *
 * Ids are built from the field's path, a path is unique *within a form*, and `getElementById`
 * returns the first in the document. So the reference does not dangle — which would at least be
 * silent — it resolves to the wrong element: a person filling in the second form with a screen
 * reader hears the hint of a field they are not looking at. Nothing is visibly wrong and nothing
 * throws; the page is answering a different question correctly.
 *
 * Two forms of one shape is not an exotic arrangement: a filter beside a form, a repeated row, two
 * tabs compared side by side, a dialog over a page.
 */
import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { MdyDynamicField } from "@modyra/core";
import { MdyDynamicFormComponent } from "./mdy-dynamic-form.component";

@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form [fields]="fields()" /><mdy-dynamic-form [fields]="fields()" />`,
})
class TwoForms {
  fields = signal<MdyDynamicField[]>([
    { name: "n", kind: "text", label: "Name", supportingText: "the help this form offers" },
  ]);
}

@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form [fields]="fields()" [idScope]="'chosen'" />`,
})
class ScopedByHand {
  fields = signal<MdyDynamicField[]>([{ name: "n", kind: "text", label: "Name" }]);
}

/** Every reference on the page, resolved to the element it actually names. */
function referencesOf(host: HTMLElement) {
  return Array.from(host.querySelectorAll("[aria-describedby]")).map((control) => {
    const id = control.getAttribute("aria-describedby") ?? "";
    const target = Array.from(host.querySelectorAll("[id]")).find((element) => element.id === id) ?? null;
    return {
      id,
      resolves: target !== null,
      insideOwnForm: control.closest("mdy-dynamic-form")?.contains(target) ?? false,
    };
  });
}

describe("MdyDynamicFormComponent, two forms of one document", () => {
  it("each field is described by its own form's text", () => {
    const fixture = TestBed.createComponent(TwoForms);
    fixture.detectChanges();
    const found = referencesOf(fixture.nativeElement);

    // The perimeter: two forms, each with a reference. "Every reference stays home" is also true of
    // a page with no references at all, which is the reading this gets for free without it.
    expect(found).toHaveLength(2);
    expect(found.every((one) => one.resolves)).toBe(true);
    // And the ids differ, which is the mechanism. Equal ids resolving home would mean the two forms
    // are the same element — the assertion above would pass on a page that had drawn one form twice.
    expect(new Set(found.map((one) => one.id)).size).toBe(2);
    expect(found.every((one) => one.insideOwnForm)).toBe(true);
  });

  it("a scope bound by hand is the one used", () => {
    const fixture = TestBed.createComponent(ScopedByHand);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    // Filling the silence is not overruling: a consumer that names a scope keeps it, because the
    // name may be one their own markup refers to from outside this component.
    expect(host.querySelector("input")?.id).toContain("chosen");
  });
});
