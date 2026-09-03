import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyDatePickerComponent } from "./datepicker.component";

/**
 * The longer stride is one the table declares, and one the calendar actually takes.
 *
 * `PageUp` turns to the previous month and `Shift`+`PageUp` to the previous year. The second half
 * shipped in every renderer and was written down nowhere, so a legend built from the keyboard table
 * would have told a person the calendar turns a month at a time — half of what their keyboard does.
 * The mirror of this batch's other defects: there, rules declared and honoured by nobody; here, an
 * act honoured and declared by nobody.
 *
 * **Both halves are asserted, and the bare one first**, because a run where the plain press also
 * failed to move would report "the year did not jump" about a calendar that was not moving at all.
 * The keys are read from the declaration, so a moved binding cannot leave this passing.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyDatePickerComponent],
  template: `<mdy-form [form]="form"><mdy-control-datepicker [field]="form.f.d" [ariaLabel]="'D'" /></mdy-form>`,
})
class Host { readonly form = mdyForm({ d: field<string | null>(null) }); }

function pagingKey(kind: "datepicker"): string {
  const declared = MDY_WIDGET_KEYBOARD[kind].filter((one) => one.longStride === true && one.when === "open");
  expect(declared.length).toBeGreaterThan(0);
  const back = declared.find((one) => one.by === -1);
  expect(back).toBeTruthy();
  expect(back!.page).toBe(true);
  return back!.key;
}

const yearOf = (heading: string | null): number => Number(/\d{4}/.exec(heading ?? "")?.[0]);

describe("the calendar's longer stride", () => {
  it("the page key turns a month, and held with Shift it turns a year", () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const opener = (fixture.nativeElement.querySelector("[aria-haspopup]")
      ?? fixture.nativeElement.querySelector("[aria-expanded]")) as HTMLElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();

    const heading = (): string | null =>
      (fixture.nativeElement.querySelector(".mdy-datepicker__header-label")
        ?? fixture.nativeElement.querySelector(".mdy-datepicker__view-toggle"))?.textContent?.trim() ?? null;
    expect(heading()).toBeTruthy();

    const press = (key: string, held: Record<string, boolean> = {}): void => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
      fixture.detectChanges();
    };

    const key = pagingKey("datepicker");
    const start = heading();
    const startYear = yearOf(start);
    expect(Number.isFinite(startYear)).toBe(true);

    press(key);
    const paged = heading();
    expect(paged).not.toBe(start);
    expect(yearOf(paged)).toBe(startYear);

    press(key, { shiftKey: true });
    expect(yearOf(heading())).toBe(startYear - 1);
  });
});
