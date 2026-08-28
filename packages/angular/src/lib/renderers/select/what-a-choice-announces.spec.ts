import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdySelectComponent } from "./select-renderer.component";

/**
 * The output a host binds to in order to learn *which option* was chosen.
 *
 * The form's value carries the value; the option carries its label, its group, whatever else the
 * host attached to it. A page that renders a description beside the field reads this, and there is
 * no other way to get from a value back to the option it came from without repeating the widget's
 * own key comparison.
 *
 * A select has two ways to choose — the native control the platform draws, and the panel this
 * renderer draws — and the output has to mean the same thing on both. Nothing asserted that, so a
 * change that left one path emitting and the other silent read as green.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdySelectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-select
        [field]="form.f.pick"
        [options]="options"
        [ariaLabel]="'Pick'"
        (selectionChange)="heard.push($event)"
      />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ pick: field<string | null>(null) });
  readonly options = [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
  ];
  readonly heard: { value: string | null; label: string }[] = [];
}

describe("choosing an option from the panel", () => {
  it("announces which option it was, not only that the value changed", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const rendered = fixture.debugElement.query((node) => node.componentInstance instanceof MdySelectComponent);
    expect(rendered).toBeTruthy();
    const select = rendered.componentInstance as {
      selectOption(option: { value: string; label: string }): void;
    };

    select.selectOption({ value: "b", label: "Banana" });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().pick).toBe("b");
    expect(fixture.componentInstance.heard.map((one) => one.label)).toEqual(["Banana"]);
  });
});
