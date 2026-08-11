import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { compose, integer, max, maxLength, min, minLength, pattern, required } from "@modyra/core";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyNumberComponent } from "./number/number-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";

/**
 * A rule declares what it enforces, and the control offers it — third renderer.
 *
 * The boundary is the model: the attribute constrains typing, and a value arriving from anywhere
 * else is kept whole and judged by the rule.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.code" [ariaLabel]="'Code'" />
      <mdy-control-text [field]="form.f.note" [ariaLabel]="'Note'" />
      <mdy-control-text [field]="form.f.free" [ariaLabel]="'Free'" />
      <mdy-control-number [field]="form.f.qty" [ariaLabel]="'Qty'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({
    code: field("", [minLength(3), maxLength(8), pattern(/^[A-Z]+$/)]),
    note: field("", [compose(required(), maxLength(10))]),
    free: field(""),
    qty: field(0, [integer(), min(0), max(255)]),
  });
}

describe("the constraints a field's rules state", () => {
  const inputs = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return {
      fixture,
      all: [...fixture.nativeElement.querySelectorAll("input")] as HTMLInputElement[],
    };
  };

  it("reach a text input", () => {
    const [code] = inputs().all;
    expect(code!.getAttribute("minlength")).toBe("3");
    expect(code!.getAttribute("maxlength")).toBe("8");
    expect(code!.getAttribute("pattern")).toBe("^[A-Z]+$");
  });

  it("survive composition", () => {
    const { fixture, all } = inputs();
    expect(all[1]!.getAttribute("maxlength")).toBe("10");
    expect(fixture.componentInstance.form.f.note.required()).toBe(true);
  });

  it("are absent where no rule states one", () => {
    const free = inputs().all[2]!;
    for (const name of ["minlength", "maxlength", "pattern"]) {
      expect(free.getAttribute(name)).toBeNull();
    }
  });

  it("reach a number input, step included", () => {
    const qty = inputs().all[3]!;
    expect(qty.getAttribute("min")).toBe("0");
    expect(qty.getAttribute("max")).toBe("255");
    expect(qty.getAttribute("step")).toBe("1");
  });

  it("constrain typing and never the model", () => {
    const { fixture, all } = inputs();
    const form = fixture.componentInstance.form;

    form.f.note.set("far longer than ten characters");
    fixture.detectChanges();

    expect(form.value().note).toBe("far longer than ten characters");
    expect(form.f.note.valid()).toBe(false);
    expect(all[1]!.getAttribute("maxlength")).toBe("10");
  });
});
