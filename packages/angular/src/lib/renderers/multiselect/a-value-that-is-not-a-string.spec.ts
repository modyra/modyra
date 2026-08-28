import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * A chosen value that is an object, carried through the gestures that act on one chip.
 *
 * An options list usually holds objects, and the widget tells one chosen value from another by a key
 * derived from it. The contract derives a structural key — `{"id":1,"name":"Red"}` — which is
 * correct as a key and is not a legal attribute selector: the first quote closes it, and the browser
 * raises `SyntaxError` rather than returning nothing. A gesture built on one does not misbehave, it
 * throws, and it takes its handler with it.
 *
 * Nothing here was exercised with a value that is not a string, which is how it survived: on strings
 * a selector and a comparison agree.
 */
interface Colour {
  readonly id: number;
  readonly name: string;
}

const RED: Colour = { id: 1, name: "Red" };
const BLUE: Colour = { id: 2, name: "Blue" };
const GREEN: Colour = { id: 3, name: "Green" };

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect
        [field]="form.f.tags"
        [options]="options()"
        [reorderable]="true"
        [ariaLabel]="'Colours'"
      />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ tags: field<readonly Colour[]>([RED, BLUE, GREEN]) });
  readonly options = signal([RED, BLUE, GREEN].map((value) => ({ value, label: value.name })));
}

describe("a multiselect holding values that are objects", () => {
  const chips = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll(".mdy-multiselect__chips [data-key]")) as HTMLElement[];

  it("draws one chip per distinct object, not one for all of them", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(chips(fixture).length).toBe(3);
  });

  it("finds a chip by its key rather than selecting with it", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const first = chips(fixture)[0];
    expect(first).toBeDefined();
    const key = first?.dataset["key"] ?? "";

    // The two halves together. Asserting only the second would pass against a key nothing breaks on.
    expect(() => host.querySelector(`[data-key="${key}"]`)).toThrow();
    expect((Array.from(host.querySelectorAll("[data-key]")) as HTMLElement[])
      .find((chip) => chip.dataset["key"] === key)).toBeDefined();
  });

  it("removes the chip a person asked to remove", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    (chips(fixture)[0]?.querySelector(".mdy-chip__remove") as HTMLElement | null)?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().tags.map((one) => one.name)).toEqual(["Blue", "Green"]);
  });
});
