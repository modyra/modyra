import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyNumberComponent } from "./number-renderer.component";

/**
 * A stepper press lands where the box's own arrow key would: on the grid that starts at `min`, at
 * the step's own precision, and never through a bound.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyNumberComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-number [field]="form.f.gridded" [ariaLabel]="'Gridded'" [minValue]="1" [step]="5" />
      <mdy-control-number [field]="form.f.price" [ariaLabel]="'Price'" [step]="0.1" />
      <mdy-control-number [field]="form.f.capped" [ariaLabel]="'Capped'" [maxValue]="7" [step]="3" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({
    gridded: field<number | null>(3),
    price: field<number | null>(0.1),
    capped: field<number | null>(10),
  });
}

function press(fixture: ComponentFixture<HostComponent>, index: number, which: "up" | "down"): string {
  const host = fixture.nativeElement as HTMLElement;
  const input = Array.from(host.querySelectorAll("input"))[index]!;
  const button = input.parentElement!.querySelector(`.mdy-spin-btn-${which}`) as HTMLButtonElement;
  button.click();
  fixture.detectChanges();
  return input.value;
}

describe("a number control's steppers", () => {
  it("move an off-grid value onto the grid that starts at min", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(press(fixture, 0, "up")).toBe("6");
    expect(fixture.componentInstance.form.f.gridded.value()).toBe(6);
  });

  it("step a decimal without carrying binary error", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(press(fixture, 1, "up")).toBe("0.2");
    expect(press(fixture, 1, "up")).toBe("0.3");
    expect(fixture.componentInstance.form.f.price.value()).toBe(0.3);
  });

  it("bring a value above max down to the grid, not to an off-grid max", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(press(fixture, 2, "down")).toBe("6");
  });

  it("leave a value above max alone when pressed further up", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(press(fixture, 2, "up")).toBe("10");
  });
});
