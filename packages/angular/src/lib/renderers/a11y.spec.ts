import { Component, Injector, signal } from "@angular/core";
import { CATALOG_KINDS, CatalogHost } from "./catalog-host.spec";
import { TestBed } from "@angular/core/testing";
import * as axe from "axe-core";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdySelectOption } from "../core/types";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyColorsComponent } from "./colors/colors-renderer.component";
import { MdyDateRangePickerComponent } from "./datepicker/daterange-renderer.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { MdyMultiselectComponent } from "./multiselect/multiselect-renderer.component";
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
    MdyColorsComponent,
    MdyMultiselectComponent,
    MdyRadioGroupComponent,
    MdyDatePickerComponent,
    MdyDateRangePickerComponent,
    MdyTimepickerComponent,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="firstName" label="First Name" placeholder="John" />
      <!-- Searchable: the plain select renders a native <select>, which has no popup of its own
           to audit. The custom dropdown is the one with a listbox in it. -->
      <mdy-control-select name="fruit" label="Fruit" [options]="fruitOptions" [searchable]="true" />
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
      <mdy-control-colors name="brand" label="Brand colour" />
      <!-- Searchable, so it renders the button that opens its overlay. -->
      <mdy-control-multiselect name="toppings" label="Toppings" [options]="fruitOptions" [searchable]="true" />
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

/** Runs axe over a subtree and returns the blocking violations, spelled for a failure message. */
async function blockingViolations(root: HTMLElement): Promise<string[]> {
  // jsdom has no layout engine: color-contrast cannot be computed and is
  // covered by the browser smoke test instead.
  const results = await axe.run(root, {
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations
    .filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    )
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    );
}

describe("renderer accessibility (axe-core)", () => {
  it("reports no critical or serious violations on the main renderers", async () => {
    const fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();

    expect(await blockingViolations(fixture.nativeElement as HTMLElement)).toEqual([]);
  });

  /**
   * The same audit, with the popups open.
   *
   * Closed, they are invisible to axe — an overlay panel carries `visibility: hidden` and axe skips
   * hidden subtrees — so everything a popup *contains* was outside this suite entirely: the
   * calendar's grid, the clock's dial, a listbox's options. That is most of the ARIA in the library,
   * and it was untested here by construction rather than by decision. A `role="row"` with no grid
   * ancestor sat in both calendars the whole time and this suite reported clean.
   *
   * Each popup is opened through its own trigger, the way a user opens it, so what is audited is
   * what a user would actually be given.
   */
  const POPUPS: ReadonlyArray<readonly [name: string, opener: string, popup: string]> = [
    ["datepicker", ".mdy-datepicker__toggle", ".mdy-datepicker__popup"],
    ["daterange", ".mdy-datepicker__popup--range", ".mdy-datepicker__popup--range"],
    ["timepicker", ".mdy-timepicker__toggle", ".mdy-timepicker__popup"],
    ["select", ".mdy-select__trigger", ".mdy-select__dropdown"],
    ["colors", ".mdy-colors__toggle-area", ".mdy-colors__dropdown"],
    ["multiselect", ".mdy-multiselect__trigger", ".mdy-multiselect__dropdown"],
  ];

  for (const [name, opener, popup] of POPUPS) {
    it(`reports no critical or serious violations with the ${name} open`, async () => {
      const fixture = TestBed.createComponent(A11yHost);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      // The daterange shares the datepicker's toggle class, so it is opened by position rather
      // than by a selector that would find the plain datepicker's toggle first.
      const triggers = Array.from(
        host.querySelectorAll<HTMLElement>(
          name === "daterange" ? ".mdy-datepicker__toggle" : opener,
        ),
      );
      const trigger = name === "daterange" ? triggers[1] : triggers[0];
      if (!trigger) throw new Error(`no trigger to open the ${name}`);
      trigger.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      if (!host.querySelector(popup)) {
        throw new Error(`the ${name} did not open, so nothing inside it was audited`);
      }

      expect(await blockingViolations(host)).toEqual([]);
    });
  }
});

/**
 * The same audit, with the error lists on screen.
 *
 * An error list renders only once a field is touched and failing, and nothing here had ever driven a
 * field into that state — the fields in this file carry no validators, so they cannot fail. Every
 * `mdy-control__errors` in the library was therefore outside this suite by construction, and that is
 * the element the whole error-reporting path ends at. The catalogue host is used instead: every
 * control there is `mdyRequired`, so touching one is enough to make it report.
 */
describe("renderer accessibility, with errors showing", () => {
  it("reports no critical or serious violations once the fields are invalid and touched", async () => {
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();
    for (const { name } of CATALOG_KINDS) {
      fixture.componentInstance.adapter.getField(name)?.().touched.set(true);
    }
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    // A run that renders no error list proves nothing about error lists.
    const lists = host.querySelectorAll(".mdy-control__errors");
    expect(`error lists on screen: ${lists.length > 0}`).toBe("error lists on screen: true");

    expect(await blockingViolations(host)).toEqual([]);
  });
});
