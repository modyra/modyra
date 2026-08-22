import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { required } from "@modyra/core";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyTextComponent } from "./text/text-renderer.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent, MdyCheckboxComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.name" [ariaLabel]="'Name'" />
      <mdy-control-checkbox [field]="form.f.agreed" [ariaLabel]="'Agreed'" />
    </mdy-form>
  `,
})
class Host {
  readonly form = mdyForm({ name: field("", [required()]), agreed: field(false, [required()]) });
}

/**
 * What a renderer stopped spelling, and still exposes.
 *
 * Five renderers used to write the ARIA set attribute by attribute; they bind the projection's
 * control part now, like the other nine. The source-level audit of the Angular UI records fewer
 * attribute *names* in those templates as a result — this asserts the thing that actually matters,
 * which is what the DOM carries.
 */
describe("the aria a renderer no longer spells", () => {
  it("still reaches the DOM through the part", () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

    expect(input.getAttribute("aria-required")).toBe("true");
    // Touched first: `aria-invalid` says what the error list says, and neither says it about a rule
    // the person has not been given a chance to answer.
    input.dispatchEvent(new Event("blur"));
    fixture.detectChanges();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-disabled")).toBe("false");
  });

  it("names the error list once there is one to name", () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

    // Nothing describes it yet: the error list is deferred until the field is touched, and no
    // supporting text was projected. Naming an element that is not in the document is the defect
    // this rule exists to avoid.
    expect(input.getAttribute("aria-describedby")).toBeNull();

    fixture.componentInstance.form.f.name.markAsTouched();
    fixture.detectChanges();

    expect(input.getAttribute("aria-describedby")).toBeTruthy();
  });
});
