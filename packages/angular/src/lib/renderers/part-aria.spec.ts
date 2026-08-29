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
    // Answered first: `aria-invalid` says what the error list says, and neither says it about a rule
    // the person has not been given a chance to answer. Typing and clearing again is that answer;
    // a traversal is not one. ADR 0167.
    input.value = "x";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    input.value = "";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-disabled")).toBe("false");
  });

  it("names the error list once there is one to name", () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

    // The reference is already there and already resolves. It used to be absent, because the error
    // container appeared with the first message; the container is now reserved under any field that
    // can fail a rule, so the reference never changes — and a reference that never changes has no
    // moment at which it can name an element not yet drawn, which is the defect this rule exists to
    // avoid. What the container holds is the next assertions' business; that it is nameable is this
    // one's.
    const before = input.getAttribute("aria-describedby");
    expect(before).not.toBeNull();
    for (const id of (before ?? "").split(" ")) {
      expect(`${id} resolves: ${Boolean(document.getElementById(id))}`).toBe(`${id} resolves: true`);
    }


    fixture.componentInstance.form.f.name.markAsTouched();
    fixture.detectChanges();

    expect(input.getAttribute("aria-describedby")).toBeTruthy();
  });
});
