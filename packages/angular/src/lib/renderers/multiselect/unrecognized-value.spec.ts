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

  it("still shows what is held while the options have not loaded", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.options.set([]);
    fixture.detectChanges();

    // An empty list is a list that has not arrived, not one that refuses the value. The strip shows
    // what is held whether or not the catalogue can name it — which is what makes it removable.
    expect(text(fixture)).toContain("imported-tag");
    expect(fixture.componentInstance.form.value().tags).toEqual(["food", "imported-tag"]);
  });
});

/**
 * The same rule where a host has also said which values it will offer.
 *
 * `filterFn` narrows what may be added. It is not a statement about what is already held: a
 * cross-field rule that changes the offered catalogue — the country moves, so the cities do — must
 * not make the city already chosen disappear from the list it is chosen in. ADR 0196.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect
        [field]="form.f.tags"
        [options]="options()"
        [filterFn]="filterFn()"
        [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class FilteredHostComponent {
  readonly form = mdyForm({ tags: field<readonly string[]>(["imported-tag"]) });
  readonly options = signal([
    { value: "food", label: "Food" },
    { value: "drinks", label: "Drinks" },
  ]);
  readonly filterFn = signal<((value: string) => boolean) | undefined>(undefined);
}

describe("a multiselect whose host filters what may be offered", () => {
  /** The labels the panel is offering, read where the options are drawn. */
  function offered(fixture: { nativeElement: HTMLElement }): readonly string[] {
    const panel = fixture.nativeElement.querySelector(".mdy-multiselect__options");
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(".mdy-chip")).map((chip) => chip.textContent?.trim() ?? "");
  }

  function open(fixture: ReturnType<typeof TestBed.createComponent<FilteredHostComponent>>): void {
    const trigger = fixture.nativeElement.querySelector(".mdy-multiselect__trigger") as HTMLElement | null;
    expect(trigger).toBeTruthy();
    trigger!.click();
    fixture.detectChanges();
  }

  it("offers the held value with no filter in play", () => {
    const fixture = TestBed.createComponent(FilteredHostComponent);
    fixture.detectChanges();
    open(fixture);

    // The control of the pair: without this, a panel that offers nothing at all would pass the
    // assertion below by never mentioning the value either.
    expect(offered(fixture).join(" ")).toContain("imported-tag");
  });

  it("offers the held value even when the filter would refuse it", () => {
    const fixture = TestBed.createComponent(FilteredHostComponent);
    fixture.componentInstance.filterFn.set((value) => value !== "imported-tag");
    fixture.detectChanges();
    open(fixture);

    const shown = offered(fixture).join(" ");
    expect(shown).toContain("imported-tag");
    // And the filter still does its own work: a value nobody holds and the filter refuses stays out.
    fixture.componentInstance.filterFn.set((value) => value !== "drinks" && value !== "imported-tag");
    fixture.detectChanges();
    expect(offered(fixture).join(" ")).not.toContain("Drinks");
  });
});
