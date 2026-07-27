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
      <mdy-control-select name="fruit" label="Fruit" [options]="options" [searchable]="true" />
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
  it("hides the real overlay panel after an option is selected", () => {
    const fixture = TestBed.createComponent(SelectHost);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css(".mdy-select__trigger"));
    trigger.triggerEventHandler("click", new MouseEvent("click"));
    fixture.detectChanges();

    const panel = fixture.debugElement.query(By.css(".mdy-overlay-panel"));
    expect(panel).not.toBeNull();
    expect(panel.classes["mdy-overlay-panel--visible"]).toBe(true);

    const option = fixture.debugElement.queryAll(By.css(".mdy-select__option"))[0]!;
    option.triggerEventHandler("click", new MouseEvent("click"));
    fixture.detectChanges();

    // DebugElement.classes omette le classi false: undefined significa assente.
    expect(panel.classes["mdy-overlay-panel--visible"]).toBeFalsy();
    expect(trigger.attributes["aria-expanded"]).toBe("false");

    const select = fixture.debugElement.query(
      By.directive(MdySelectComponent),
    ).componentInstance as MdySelectComponent<string>;
    expect(select.value()).toBe("a");
  });

});
