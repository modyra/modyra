import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { max, min } from "@modyra/core";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyNumberComponent } from "./number-renderer.component";

/**
 * The constraint the control offers is the rule the field already carries.
 *
 * Writing it twice — once as a validator, once on the control — is how a form comes to accept at
 * the keyboard what it rejects on submit, and the author has no way to notice.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyNumberComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-number [field]="form.f.quantity" [ariaLabel]="'Quantity'" />
      <mdy-control-number [field]="form.f.quantity" [ariaLabel]="'Narrowed'" [minValue]="10" />
      <mdy-control-number [field]="form.f.free" [ariaLabel]="'Free'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({
    quantity: field(0, [min(0), max(255)]),
    free: field(0),
  });
}

describe("a number control and the field's own bounds", () => {
  it("offers the range the validators state", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const inputs = [...fixture.nativeElement.querySelectorAll("input")] as HTMLInputElement[];

    expect(inputs[0]!.min).toBe("0");
    expect(inputs[0]!.max).toBe("255");
  });

  it("lets the control narrow what it offers without touching the rule", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const inputs = [...fixture.nativeElement.querySelectorAll("input")] as HTMLInputElement[];

    expect(inputs[1]!.min).toBe("10");
    expect(inputs[1]!.max).toBe("255");
  });

  it("offers nothing for a field with no rule", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const inputs = [...fixture.nativeElement.querySelectorAll("input")] as HTMLInputElement[];

    expect(inputs[2]!.min).toBe("");
    expect(inputs[2]!.max).toBe("");
  });
});
