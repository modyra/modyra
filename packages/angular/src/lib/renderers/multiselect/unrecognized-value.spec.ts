import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * The rule of ADR 0029 for a widget that holds several values.
 *
 * What the widget will not erase, it has to show — and what it shows, the user can take off. An
 * imported tag that no longer exists in the catalogue is how a value gets here, and it is the one a
 * person has to see in order to resolve it.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options()" [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ tags: field<readonly string[]>(["food", "imported-tag"]) });
  readonly options = signal([
    { value: "food", label: "Food" },
    { value: "drinks", label: "Drinks" },
  ]);
}

describe("a multiselect holding a value its options do not contain", () => {
  const text = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.textContent ?? "";

  it("keeps it and shows it", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().tags).toEqual(["food", "imported-tag"]);
    expect(text(fixture)).toContain("imported-tag");
  });

  it("adds nothing for a value the options contain", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.form.f.tags.set(["food"]);
    fixture.detectChanges();

    expect(text(fixture)).not.toContain("imported-tag");
  });

  it("adds nothing while the options have not loaded", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.options.set([]);
    fixture.detectChanges();

    expect(text(fixture)).not.toContain("imported-tag");
    expect(fixture.componentInstance.form.value().tags).toEqual(["food", "imported-tag"]);
  });
});
