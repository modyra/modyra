import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { max, min } from "@modyra/core";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdySliderComponent } from "./slider-renderer.component";

/** The track a slider spans is the range the field already states, and the fill agrees with it. */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdySliderComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-slider [field]="form.f.level" [ariaLabel]="'Level'" />
      <mdy-control-slider [field]="form.f.free" [ariaLabel]="'Free'" />
      <mdy-control-slider [field]="form.f.level" [ariaLabel]="'Narrowed'" [min]="20" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({
    level: field(30, [min(10), max(50)]),
    free: field(50),
  });
}

describe("a slider and the field's own bounds", () => {
  const inputs = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return [...fixture.nativeElement.querySelectorAll("input")] as HTMLInputElement[];
  };

  it("spans the range the rules state", () => {
    expect(inputs()[0]!.min).toBe("10");
    expect(inputs()[0]!.max).toBe("50");
  });

  it("assumes a bare range input's track when there is no rule", () => {
    expect(inputs()[1]!.min).toBe("0");
    expect(inputs()[1]!.max).toBe("100");
  });

  it("lets the control narrow the track without touching the rule", () => {
    expect(inputs()[2]!.min).toBe("20");
    expect(inputs()[2]!.max).toBe("50");
  });
});
