import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * The grid of choices in an open multiselect is named by the field's caption.
 *
 * The contract's `group` part names it with `aria-labelledby` at the caption. Where no caption is
 * drawn there is nothing to point at, and the grid takes the field's fallback name instead. Under
 * ADR 0214 the control's own `aria-label` is null whenever a caption exists, so a grid that only
 * borrowed it would be a group with no name.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options" [label]="'Tags'" />
    </mdy-form>
  `,
})
class CaptionedHostComponent {
  readonly form = mdyForm({ tags: field<readonly string[]>([]) });
  readonly options = [{ value: "food", label: "Food" }];
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options" [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class UncaptionedHostComponent {
  readonly form = mdyForm({ tags: field<readonly string[]>([]) });
  readonly options = [{ value: "food", label: "Food" }];
}

function openGrid(fixture: { nativeElement: HTMLElement; detectChanges(): void }): HTMLElement {
  fixture.detectChanges();
  (fixture.nativeElement.querySelector(".mdy-multiselect__trigger") as HTMLElement).click();
  fixture.detectChanges();
  const grid = fixture.nativeElement.querySelector(".mdy-multiselect__options") as HTMLElement | null;
  expect(grid).toBeTruthy();
  return grid!;
}

describe("the options grid of a multiselect", () => {
  it("is named by the caption it points at", () => {
    const fixture = TestBed.createComponent(CaptionedHostComponent);
    const grid = openGrid(fixture);
    const id = grid.getAttribute("aria-labelledby");
    // The reference must resolve to the caption itself, or the group is named by nothing.
    expect(id).toBeTruthy();
    expect(fixture.nativeElement.ownerDocument.getElementById(id!)?.textContent).toContain("Tags");
    expect(grid.hasAttribute("aria-label")).toBe(false);
  });

  it("takes the field's own name where no caption is drawn", () => {
    const fixture = TestBed.createComponent(UncaptionedHostComponent);
    const grid = openGrid(fixture);
    expect(grid.getAttribute("aria-label")).toBe("Tags");
    expect(grid.hasAttribute("aria-labelledby")).toBe(false);
  });
});
