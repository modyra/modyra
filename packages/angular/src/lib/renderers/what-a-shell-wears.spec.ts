import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyColorsComponent } from "./colors/colors-renderer.component";
import { MdyMultiselectComponent } from "./multiselect/multiselect-renderer.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySelectComponent } from "./select/select-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";

/**
 * What a field's own element wears once somebody has been at it.
 *
 * `mdy-renderer--touched` is bound once, on the control every renderer extends, and inherited. It
 * used to be written again in fifteen host blocks, each an identical copy of what the base already
 * declared — so a rename would have had to reach sixteen places, and a renderer added without the
 * line would have looked wrong and behaved right.
 *
 * The reason this needs a check rather than a reading: host metadata is inherited by a mechanism
 * nothing here controls, and a change to how a component is declared can stop it arriving without
 * any behaviour test noticing — the class is what a stylesheet selects on, and no assertion in this
 * suite reads a stylesheet. Several kinds, because one kind's quirk is not the rule.
 */
@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyCheckboxComponent, MdyRadioGroupComponent,
    MdySelectComponent, MdyMultiselectComponent, MdyColorsComponent,
  ],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.a" [ariaLabel]="'A'" />
      <mdy-control-checkbox [field]="form.f.b" [ariaLabel]="'B'" />
      <mdy-control-radio [field]="form.f.c" [options]="options" [ariaLabel]="'C'" />
      <mdy-control-select [field]="form.f.d" [options]="options" [ariaLabel]="'D'" />
      <mdy-control-multiselect [field]="form.f.e" [options]="options" [ariaLabel]="'E'" />
      <mdy-control-colors [field]="form.f.g" [ariaLabel]="'G'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly options = [{ value: "a", label: "A" }];
  readonly form = mdyForm({
    a: field(""),
    b: field(false),
    c: field<string | null>(null),
    d: field<string | null>(null),
    e: field<readonly string[]>([]),
    g: field(""),
  });
}

const KINDS: ReadonlyArray<readonly [string, string, string]> = [
  ["text", "mdy-control-text", "a"],
  ["checkbox", "mdy-control-checkbox", "b"],
  ["radio", "mdy-control-radio", "c"],
  ["select", "mdy-control-select", "d"],
  ["multiselect", "mdy-control-multiselect", "e"],
  ["colors", "mdy-control-colors", "g"],
];

describe("the classes a field's element carries", () => {
  for (const [kind, selector, name] of KINDS) {
    it(`${kind}: puts on the touched class from the control it extends, and keeps its own`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const shell = fixture.nativeElement.querySelector(selector) as HTMLElement;

      const before = Array.from(shell.classList);
      expect(before).toContain("mdy-renderer");
      expect(before).not.toContain("mdy-renderer--touched");

      const handle = (fixture.componentInstance.form.f as Record<string, { markAsTouched(): void } | undefined>)[name];
      expect(handle).toBeDefined();
      handle?.markAsTouched();
      fixture.detectChanges();

      const after = Array.from(shell.classList);
      expect(after).toContain("mdy-renderer--touched");
      // And the kind's own classes are still there. A binding that replaces rather than merges takes
      // them away, and every behavioural check stays green while the stylesheet stops matching.
      expect(after).toContain("mdy-renderer");
      expect(after.filter((one) => one.startsWith("mdy-renderer--") && one !== "mdy-renderer--touched").length)
        .toBeGreaterThan(0);
    });
  }
});
