import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import * as axe from "axe-core";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdySelectOption } from "../core/types";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyDateRangePickerComponent } from "./datepicker/daterange-renderer.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySelectComponent } from "./select/select-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";
import { MdyTimepickerComponent } from "./timepicker/timepicker-renderer.component";

function makeAdapter(seed?: Record<string, unknown>): MdyDeclarativeAdapter {
  return new MdyDeclarativeAdapter(
    signal(seed),
    undefined,
    TestBed.inject(Injector),
  );
}

@Component({
  standalone: true,
  imports: [
    MdyFormComponent,
    MdyTextComponent,
    MdySelectComponent,
    MdyCheckboxComponent,
    MdyRadioGroupComponent,
    MdyDatePickerComponent,
    MdyDateRangePickerComponent,
    MdyTimepickerComponent,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="firstName" label="First Name" placeholder="John" />
      <mdy-control-select name="fruit" label="Fruit" [options]="fruitOptions" />
      <mdy-control-checkbox
        name="acceptTerms"
        label="I accept the terms and conditions"
      />
      <mdy-control-radio
        name="preferredContact"
        label="Preferred Contact Method"
        [options]="contactOptions"
      />
      <mdy-control-datepicker name="birthDate" label="Date of Birth" />
      <mdy-control-daterange name="stay" label="Stay" />
      <mdy-control-timepicker name="alarm" label="Alarm" />
    </mdy-form>
  `,
})
class A11yHost {
  adapter = makeAdapter({ fruit: "b", preferredContact: "email" });
  fruitOptions: ReadonlyArray<MdySelectOption<string>> = [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
  ];
  contactOptions: ReadonlyArray<MdySelectOption<string>> = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
  ];
}

describe("renderer accessibility (axe-core)", () => {
  it("reports no critical or serious violations on the main renderers", async () => {
    const fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();

    // jsdom has no layout engine: color-contrast cannot be computed and is
    // covered by the browser smoke test instead.
    const results = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    );

    expect(
      blocking.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .map((node) => node.target.join(" "))
            .join(", ")}`,
      ),
    ).toEqual([]);
  });
});
