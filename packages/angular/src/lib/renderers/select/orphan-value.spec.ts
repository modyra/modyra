import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdySelectComponent } from "./select-renderer.component";

/**
 * A value the option list does not contain.
 *
 * It gets there legitimately: an import carries the name of a category that does not exist yet, a
 * saved record refers to something since deleted, options arrive from a service that filtered them.
 * Erasing it to make the widget consistent destroys the one thing that lets a person fix it — and
 * does so silently, because the control then simply looks empty.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdySelectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-select [field]="form.f.category" [options]="options()" [ariaLabel]="'Category'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ category: field("ZT Invented Category") });
  readonly options = signal([
    { value: "drinks", label: "Drinks" },
    { value: "food", label: "Food" },
  ]);
}

describe("a select holding a value its options do not contain", () => {
  it("keeps the value in the form", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().category).toBe("ZT Invented Category");
  });

  it("shows it, so the person who has to fix it can see it", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("ZT Invented Category");
  });

  it("stops showing it once the options catch up", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.options.set([
      { value: "ZT Invented Category", label: "ZT Invented Category" },
      { value: "food", label: "Food" },
    ]);
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll("[role='option']")].map(
      (el) => (el as HTMLElement).textContent?.trim(),
    );
    expect(labels.filter((l) => l === "ZT Invented Category").length).toBeLessThanOrEqual(1);
    expect(fixture.componentInstance.form.value().category).toBe("ZT Invented Category");
  });

  it("adds nothing while the options have not loaded", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.options.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll("[role='option']").length).toBe(0);
    expect(fixture.componentInstance.form.value().category).toBe("ZT Invented Category");
  });
});
