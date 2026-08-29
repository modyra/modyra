/**
 * A date a person types is read the same way whichever adapter drew the field.
 *
 * How a control *writes* a date is its own choice — a form may show `2026-01-02` or `02/01/2026`.
 * What a person may *type* is not one: they are looking at one document, and a field that refuses
 * `01/02/2026` because it happens to display the canonical spelling makes the same form answer
 * differently depending on which renderer built it.
 *
 * The shared reading takes the canonical spelling first and the locale's order after it, so both are
 * understood everywhere.
 */
import { TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { Injector } from "@angular/core";

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyDatePickerComponent],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-datepicker name="when" label="When" displayFormat="iso" />
    </mdy-form>
  `,
})
class DateHost {
  adapter = new MdyDeclarativeAdapter(
    signal({ version: 2 as const, fields: [{ name: "when", kind: "datepicker" as const, label: "When" }] }),
    undefined,
    TestBed.inject(Injector),
  );
}

describe("one document, one date", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["the locale's order", "01/02/2026"],
    ["the canonical form", "2026-02-01"],
  ];
  for (const [spelling, typed] of cases) {
    it(`reads ${spelling} while displaying the canonical one`, () => {
      const fixture = TestBed.createComponent(DateHost);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
      expect(input).toBeTruthy();

      input.value = typed;
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new Event("change"));
      input.dispatchEvent(new FocusEvent("blur"));
      fixture.detectChanges();

      // What the form holds, not what the box shows: a control that keeps text it could not read is
      // the failure this guards, and it reports the value as empty while somebody looks at their
      // own typing.
      const held = fixture.componentInstance.adapter.value()["when"] ?? null;
      expect(`${spelling} was read: ${held !== null && held !== ""}`)
        .toBe(`${spelling} was read: true`);
    });
  }
});
