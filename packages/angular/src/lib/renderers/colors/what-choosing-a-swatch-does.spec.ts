import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyColorsComponent } from "./colors-renderer.component";

/**
 * What a swatch does, which is three things and not one.
 *
 * Choosing a preset writes the value, marks the field as answered, and closes the palette — because
 * choosing one *is* the answer, where typing into the box is not: `#0` is on its way to being a
 * colour, and a palette that shut on the first keystroke would take the half-typed value away from
 * the person typing it.
 *
 * The closing is the part nothing asserted. It is also the part a renderer decides for itself unless
 * it asks: the rule for what a colour act does belongs to the kind, and three renderers each holding
 * their own copy of "and then close" is three chances to disagree about when.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyColorsComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-colors [field]="form.f.tint" [presets]="presets" [ariaLabel]="'Tint'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly presets = ["#ff0000", "#00ff00"];
  readonly form = mdyForm({ tint: field("") });
}

describe("choosing a colour from the palette", () => {
  const swatches = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll(".mdy-colors__presets button")) as HTMLElement[];

  const isOpen = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector("[aria-expanded='true']") !== null;

  it("takes the colour and shuts the palette, because choosing one is the answer", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const opener = fixture.nativeElement.querySelector("[aria-expanded]") as HTMLElement;
    opener.click();
    fixture.detectChanges();
    expect(isOpen(fixture)).toBe(true);

    const first = swatches(fixture)[0];
    expect(first).toBeDefined();
    first?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().tint).toBe("#ff0000");
    expect(isOpen(fixture)).toBe(false);
  });

  it("and having been answered, the field counts as visited", () => {
    // The other half of the same act, and the half a renderer forgets when it writes the value by
    // hand: a colour chosen and then cleared has to be able to say it is missing.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector("[aria-expanded]") as HTMLElement).click();
    fixture.detectChanges();
    swatches(fixture)[0]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.f.tint.touched()).toBe(true);
  });
});
