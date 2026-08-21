/**
 * A declared granularity reaching the control that has to honour it.
 *
 * The contract, the controller and the dial all obey a granularity; until a renderer takes one, no
 * document can ask for it — a capability nobody can reach is a capability nobody has.
 */
import { Component, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyTimepickerComponent } from "./timepicker-renderer.component";

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTimepickerComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-timepicker
        [field]="form.f.t"
        label="T"
        format="24h"
        [granularity]="{ minuteStep: 15 }"
      />
    </mdy-form>
  `,
})
class Host {
  readonly form = mdyForm({ t: field<string | null>("09:00") }, { injector: TestBed.inject(Injector) });
}

describe("a timepicker told which times it offers", () => {
  const open = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>(".mdy-timepicker__toggle")!.click();
    fixture.detectChanges();
    return { fixture, root };
  };

  /** The minute box in the popup's header. */
  const minuteBox = (root: HTMLElement) =>
    root.querySelectorAll<HTMLInputElement>(".mdy-timepicker-segment-input")[1]!;

  it("tells the segment the range it is judging against", () => {
    // `step` reaches the control that judges a typed entry: the box announces the field's bounds,
    // and a quarter-hour field is one whose minutes step by 15.
    const { root } = open();
    const minute = minuteBox(root);
    expect(minute.min).toBe("0");
    expect(minute.max).toBe("59");
    // The native attribute for exactly this, so the platform's own spinner offers what the field
    // offers rather than every minute between.
    expect(minute.step).toBe("15");
  });

  it("leaves the hour alone, which this declaration says nothing about", () => {
    const { root } = open();
    const hour = root.querySelectorAll<HTMLInputElement>(".mdy-timepicker-segment-input")[0]!;
    expect(hour.step).toBe("1");
  });
});
