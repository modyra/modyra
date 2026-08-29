import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyFileComponent } from "./file/file-renderer.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "./segmented-button/segmented-button-renderer.component";
import { MdySliderComponent } from "./slider/slider-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";

/**
 * A control is announced as something, on a document that writes no caption.
 *
 * A `label` is optional and a form is allowed to omit it. What is not optional is that somebody
 * using a screen reader hears *which* field they are on: with no name, a text box is announced as
 * "edit text" on a form of them, and voice control has nothing to say to reach it at all. That
 * criterion has no conditional clause.
 *
 * The floor only. A renderer falling back to the field's own key passes this — whether a raw key
 * should be shown, and how, is a separate decision and not one this asserts.
 *
 * Four kinds reached no fallback while eleven did, so the gap was not the resolver: two groups
 * pointed `aria-labelledby` at a caption that was not rendered, which is `null` on such a document,
 * and two inputs named themselves nowhere at all.
 */
@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyCheckboxComponent, MdySliderComponent,
    MdyRadioGroupComponent, MdySegmentedButtonComponent, MdyFileComponent,
  ],
  template: `
    <mdy-form [form]="form">
      <div id="text"><mdy-control-text [field]="form.f.a" /></div>
      <div id="checkbox"><mdy-control-checkbox [field]="form.f.b" /></div>
      <div id="slider"><mdy-control-slider [field]="form.f.c" /></div>
      <div id="radio"><mdy-control-radio [field]="form.f.d" [options]="options" /></div>
      <div id="segmented"><mdy-control-segmented [field]="form.f.e" [options]="options" /></div>
      <div id="file"><mdy-control-file [field]="form.f.g" /></div>
    </mdy-form>
  `,
})
class HostComponent {
  readonly options = [{ value: "a", label: "A" }];
  readonly form = mdyForm({
    a: field(""),
    b: field(false),
    c: field(0),
    d: field<string | null>(null),
    e: field<string | null>(null),
    g: field<readonly File[]>([]),
  });
}

const KINDS = ["text", "checkbox", "slider", "radio", "segmented", "file"];

describe("a field mounted with no caption", () => {
  /**
   * The name a reader would announce, resolved the way one resolves it: a spoken name, or the text
   * of whatever the control points at, or the caption that wraps it.
   *
   * Read from the page rather than from the binding, because a binding that writes `null` and one
   * that writes nothing are the same thing to a reader and different things in a template.
   */
  const announcedName = (scope: HTMLElement): string => {
    const control = scope.querySelector(
      "input, select, textarea, [role='radiogroup'], [role='slider'], [role='combobox']",
    ) as HTMLElement | null;
    if (control === null) return "";
    const spoken = control.getAttribute("aria-label");
    if (spoken !== null && spoken.trim() !== "") return spoken.trim();
    const points = control.getAttribute("aria-labelledby");
    if (points !== null) {
      const target = scope.ownerDocument.getElementById(points);
      if (target !== null && (target.textContent ?? "").trim() !== "") return (target.textContent ?? "").trim();
    }
    const id = control.getAttribute("id");
    const captioned = id !== null ? scope.querySelector(`label[for="${id}"]`) : null;
    if (captioned !== null && (captioned.textContent ?? "").trim() !== "") return (captioned.textContent ?? "").trim();
    const wrapping = control.closest("label");
    return wrapping !== null ? (wrapping.textContent ?? "").trim() : "";
  };

  for (const kind of KINDS) {
    it(`${kind}: is announced as something`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const scope = (fixture.nativeElement as HTMLElement).querySelector(`#${kind}`) as HTMLElement;

      // The perimeter: if the control is not on the page, "no name" is true and says nothing.
      expect(scope.querySelector("input, select, textarea, [role='radiogroup'], [role='slider']")).not.toBeNull();

      expect(`${kind}: ${announcedName(scope) || "(announced as nothing)"}`)
        .not.toBe(`${kind}: (announced as nothing)`);
    });
  }

  it("and a caption, where there is one, is what is announced", () => {
    // The control. Without it a renderer that named every field after its key would pass every row
    // above while never showing a caption anybody wrote.
    @Component({
      standalone: true,
      imports: [MdyFormComponent, MdyTextComponent],
      template: `<mdy-form [form]="form"><div id="text">
        <mdy-control-text [field]="form.f.a" [label]="'Your name'" />
      </div></mdy-form>`,
    })
    class Captioned {
      readonly form = mdyForm({ a: field("") });
    }
    const fixture = TestBed.createComponent(Captioned);
    fixture.detectChanges();
    const scope = (fixture.nativeElement as HTMLElement).querySelector("#text") as HTMLElement;
    expect(announcedName(scope)).toBe("Your name");
  });
});
