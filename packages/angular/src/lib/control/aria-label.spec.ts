import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";

/**
 * Naming a control that has no visible label.
 *
 * A cell in a table, a control in a toolbar: what a sighted reader gets from the column header, a
 * screen reader has to get from the control itself. The rule is that the name lands on the control
 * and only while nothing visible carries it — two names for one thing is how a spoken name comes to
 * disagree with a written one, which is the failure WCAG 2.5.3 is about.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.n" [label]="label" [ariaLabel]="ariaLabel" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ n: field("") });
  label = "";
  ariaLabel: string | null = "Item, row 12";
}

describe("naming a control with no visible label", () => {
  it("puts the name on the control", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Item, row 12");
  });

  it("keeps the explicit name even when a label is visible", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.label = "Item";
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Item, row 12");
    expect(fixture.nativeElement.querySelector("label")?.textContent).toContain("Item");
  });

  // `aria-label` replaces a native label rather than adding to it, so a caption is not copied onto
  // the control: it names the box through `for`. ADR 0214.
  it("leaves a captioned control to its label", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.label = "Item";
    fixture.componentInstance.ariaLabel = null;
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    const label = fixture.nativeElement.querySelector("label") as HTMLLabelElement;
    expect(input.getAttribute("aria-label")).toBeNull();
    expect(input.id).not.toBe("");
    expect(label.htmlFor).toBe(input.id);
  });

  it("writes the field's own name where no caption names it", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.ariaLabel = null;
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("n");
  });
});
