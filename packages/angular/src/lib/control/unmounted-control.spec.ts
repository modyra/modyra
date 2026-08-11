import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { required } from "@modyra/core";
import { field, group, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";

/**
 * A control inside a closed `@if`.
 *
 * This is the arrangement every Angular application has — a section behind a condition, a wizard
 * step, a tab — and it is the one nothing tested: the directive releases its claim when the control
 * is destroyed, and the engine used to take that as permission to delete the field. `getValue()`
 * then threw, because the value no longer matched the shape the schema promised.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.name" [ariaLabel]="'Name'" />
      @if (showDetails()) {
        <mdy-control-text [field]="form.f.details.note" [ariaLabel]="'Note'" />
      }
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({
    name: field("Ada", [required()]),
    details: group({ note: field("kept") }),
  });
  readonly showDetails = signal(true);
}

describe("a control that goes away", () => {
  it("leaves the field, its value and the form's shape behind", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;

    expect(form.getValue()).toEqual({ name: "Ada", details: { note: "kept" } });

    fixture.componentInstance.showDetails.set(false);
    fixture.detectChanges();

    expect(() => form.getValue()).not.toThrow();
    expect(form.getValue()).toEqual({ name: "Ada", details: { note: "kept" } });
    expect(form.fieldNames()).toContain("details.note");
  });

  it("and binds the same field again when it comes back", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;

    fixture.componentInstance.showDetails.set(false);
    fixture.detectChanges();
    form.f.details.note.set("changed while away");

    fixture.componentInstance.showDetails.set(true);
    fixture.detectChanges();

    const inputs = [...fixture.nativeElement.querySelectorAll("input")] as HTMLInputElement[];
    expect(inputs[1]!.value).toBe("changed while away");
  });
});
