import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyColorsComponent } from "./colors/colors-renderer.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { MdyDateRangePickerComponent } from "./datepicker/daterange-renderer.component";
import { MdyFileComponent } from "./file/file-renderer.component";
import { MdyMultiselectComponent } from "./multiselect/multiselect-renderer.component";
import { MdyNumberComponent } from "./number/number-renderer.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "./segmented-button/segmented-button-renderer.component";
import { MdySelectComponent } from "./select/select-renderer.component";
import { MdySliderComponent } from "./slider/slider-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";
import { MdyTextareaComponent } from "./textarea/textarea-renderer.component";
import { MdyTimepickerComponent } from "./timepicker/timepicker-renderer.component";
import { MdyToggleComponent } from "./toggle/toggle-renderer.component";

/**
 * A value of the wrong shape takes nothing off the page (ADR 0208).
 *
 * The engine holds what a document puts in the model and reports the field invalid; the control is
 * what shows that verdict, so it has to be drawn. A renderer that assumes the kind's declared shape
 * throws during change detection, and the field a person needed to read the problem from is the one
 * thing missing from the page.
 *
 * The values are cast on the way in on purpose: they model a document that wrote the wrong thing,
 * which the types forbid and the runtime allows. Removing the cast would only move the lie.
 */

/** Values no document should produce: wrong at the top level, and lists whose entries are wrong. */
const WRONG: readonly unknown[] = ["a name", 7, {}, [], true, [null], [7], ["a name"]];

@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyTextareaComponent, MdyNumberComponent, MdySliderComponent,
    MdyCheckboxComponent, MdyToggleComponent, MdyRadioGroupComponent, MdySegmentedButtonComponent,
    MdySelectComponent, MdyMultiselectComponent, MdyDatePickerComponent, MdyDateRangePickerComponent,
    MdyTimepickerComponent, MdyFileComponent, MdyColorsComponent,
  ],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.a" />
      <mdy-control-textarea [field]="form.f.b" />
      <mdy-control-number [field]="form.f.c" />
      <mdy-control-slider [field]="form.f.d" />
      <mdy-control-checkbox [field]="form.f.e" />
      <mdy-control-toggle [field]="form.f.g" />
      <mdy-control-radio [field]="form.f.h" [options]="options" />
      <mdy-control-segmented [field]="form.f.i" [options]="options" />
      <mdy-control-select [field]="form.f.j" [options]="options" />
      <mdy-control-multiselect [field]="form.f.k" [options]="options" />
      <mdy-control-datepicker [field]="form.f.l" />
      <mdy-control-daterange [field]="form.f.m" />
      <mdy-control-timepicker [field]="form.f.n" />
      <mdy-control-file [field]="form.f.o" />
      <mdy-control-colors [field]="form.f.p" />
    </mdy-form>
  `,
})
class HostComponent {
  wrong: unknown = "";
  readonly options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  readonly form = mdyForm({
    a: field(this.wrong as never), b: field(this.wrong as never), c: field(this.wrong as never),
    d: field(this.wrong as never), e: field(this.wrong as never), g: field(this.wrong as never),
    h: field(this.wrong as never), i: field(this.wrong as never), j: field(this.wrong as never),
    k: field(this.wrong as never), l: field(this.wrong as never), m: field(this.wrong as never),
    n: field(this.wrong as never), o: field(this.wrong as never), p: field(this.wrong as never),
  });
}

describe("a control given a value of the wrong shape", () => {
  for (const wrong of WRONG) {
    it(`draws every kind when the model holds ${JSON.stringify(wrong)}`, () => {
      const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
      const host = fixture.componentInstance;
      for (const key of Object.keys(host.form.f)) {
        (host.form.f as Record<string, { set(value: unknown): void }>)[key]!.set(wrong);
      }

      expect(() => fixture.detectChanges()).not.toThrow();

      const controls = fixture.nativeElement.querySelectorAll("input, select, textarea, button");
      // One per kind at least: a page that drew half of them and swallowed the rest is the defect
      // this asks about, and a count of "more than zero" would pass on it.
      expect(controls.length).toBeGreaterThanOrEqual(15);
    });
  }
});
