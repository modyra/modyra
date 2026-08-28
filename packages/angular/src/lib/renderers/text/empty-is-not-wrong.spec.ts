import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { required } from "@modyra/core";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyTextComponent } from "./text-renderer.component";

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.name" [ariaLabel]="'Name'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ name: field("", [required()]) });
}

/**
 * ADR 0165 for a kind that is not the one it was written for.
 *
 * The rule — `aria-invalid` is a verdict on an act, not a state — was settled while adopting a
 * controller for one kind. Every kind here shares one intent path, and that path still computes an
 * older answer for its own internal use: whether the form *would* refuse this field, which is true
 * for a required field the moment it is drawn empty. Whether that answer reaches the attribute is
 * the question, and reading the source does not settle it.
 *
 * Both halves are asserted. The first alone passes just as well against a renderer that never writes
 * the attribute at all, and would report silence as correctness.
 */
describe("an empty required field, in a kind that is not select", () => {
  const input = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector("input") as HTMLElement;

  it("an empty required field nobody has touched does not say it is invalid", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(input(fixture).getAttribute("aria-invalid")).not.toBe("true");
  });

  it("and the same field does say so once it has been touched and left empty", () => {
    // The perimeter. Without this the check above passes just as well against a renderer that never
    // writes the attribute at all, and would report silence as correctness.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.f.name.markAsTouched();
    fixture.detectChanges();
    expect(input(fixture).getAttribute("aria-invalid")).toBe("true");
  });
});
