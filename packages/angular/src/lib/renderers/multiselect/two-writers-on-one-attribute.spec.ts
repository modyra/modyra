import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * Which of the two writers of one ARIA attribute the element ends up carrying.
 *
 * The trigger receives the contract's projection through `[mdyPart]`, and the template also binds
 * six of the attributes that projection emits. `applyPart` rewrites what the projection names on
 * every change to it — so the attribute has two authors, written in two languages, and nothing in
 * either file says which one the page gets.
 *
 * This does not assert a preference. It records what actually lands, so that a change to either
 * author has to look at the other one, and so the answer is a measurement rather than a reading of
 * Angular's binding order.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options" [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class NoLabelHost {
  readonly form = mdyForm({ tags: field<readonly string[]>([]) });
  readonly options = [{ value: "food", label: "Food" }];
}

describe("an attribute with two writers on the multiselect trigger", () => {
  function trigger(): HTMLElement {
    const fixture = TestBed.createComponent(NoLabelHost);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector(".mdy-multiselect__trigger") as HTMLElement | null;
    expect(element).toBeTruthy();
    return element!;
  }

  it("carries the template's answer for aria-labelledby, and the projection's is discarded", () => {
    // The two disagree by construction on a field with no written caption. The projection emits
    // `aria-labelledby` unconditionally — its `labelId` is `${widgetId}__label` and is never null —
    // and the template emits it only when a caption was written. What lands is the absence, so on
    // this element the template writes last and the contract's answer does not reach the page.
    //
    // Recorded rather than preferred. The name still resolves here, through the `aria-label` the
    // host supplied; what this pins is which of the two authors decides, because nothing in either
    // file says. A change to the projection's naming would do nothing to this element until somebody
    // reads this.
    const element = trigger();

    expect(element.hasAttribute("aria-labelledby")).toBe(false);
    // And the name is not lost, which is why this is a finding about authorship rather than a defect.
    expect(element.getAttribute("aria-label")).toBe("Tags");
  });

  it("carries the states the projection emits, not an absent attribute", () => {
    const element = trigger();

    // A state attribute is a state: `aria-invalid="false"` says "checked, and fine", where an absent
    // one says nothing at all. Both writers agree the string is what belongs here; this records it.
    expect(element.getAttribute("aria-invalid")).toBe("false");
    expect(element.getAttribute("aria-required")).toBe("false");
    expect(element.getAttribute("aria-disabled")).toBe("false");
    // Readonly is the one both authors write as an absence when false, so it must not be there.
    expect(element.hasAttribute("aria-readonly")).toBe(false);
  });
});
