import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { MdyDeclarativeAdapter } from "../../core/declarative-form-adapter";
import { MdySelectOption } from "../../core/types";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdySelectComponent } from "./select-renderer.component";

function makeAdapter(seed?: Record<string, unknown>): MdyDeclarativeAdapter {
  return new MdyDeclarativeAdapter(signal(seed), undefined, TestBed.inject(Injector));
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdySelectComponent],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-select name="fruit" label="Fruit" [options]="options" />
    </mdy-form>
  `,
})
class SelectHost {
  adapter = makeAdapter({ fruit: "b" });
  options: ReadonlyArray<MdySelectOption<string>> = [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
  ];
}

describe("MdySelectComponent", () => {
  // Regression: the widget adapter used to read value()/fieldState() in the
  // constructor, before the name/[field] inputs are set — every select
  // crashed at construction with "Control needs a name attribute…".
  it("constructs before inputs are resolved and syncs afterwards", () => {
    const fixture = TestBed.createComponent(SelectHost);
    expect(() => fixture.detectChanges()).not.toThrow();

    const select = fixture.debugElement.query(
      By.directive(MdySelectComponent),
    ).componentInstance as MdySelectComponent<string>;
    expect(select.value()).toBe("b");
  });
});
