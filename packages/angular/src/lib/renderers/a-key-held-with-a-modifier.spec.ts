import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_POPUP_OPENERS, MDY_WIDGET_KEYBOARD, partClasses } from "@modyra/widgets";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyColorsComponent } from "./colors/colors-renderer.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { MdyDateRangePickerComponent } from "./datepicker/daterange-renderer.component";
import { MdyMultiselectComponent } from "./multiselect/multiselect-renderer.component";
import { MdySelectComponent } from "./select/select-renderer.component";
import { MdyTimepickerComponent } from "./timepicker/timepicker-renderer.component";

/**
 * A panel does not open under a press that belongs to the platform.
 *
 * `Cmd+Space` switches the input source, `Cmd+ArrowDown` goes to the end of a document, `Cmd+Z`
 * undoes. Somebody holding the modifier is reaching for one of those. A control that also answers
 * with its own bare-key meaning makes the press do two things, and the panel arrives under the
 * gesture that was meant to leave it.
 *
 * Asked of the renderer rather than of the resolver, because the resolver was already right and was
 * on no road: the question every renderer asks took a *key name*, so what was held with the press
 * never reached the only function that reads it.
 */
@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdySelectComponent, MdyMultiselectComponent, MdyDatePickerComponent,
    MdyDateRangePickerComponent, MdyTimepickerComponent, MdyColorsComponent,
  ],
  template: `
    <mdy-form [form]="form">
      <div id="select"><mdy-control-select [field]="form.f.a" [options]="options" [searchable]="true" [ariaLabel]="'A'" /></div>
      <div id="multiselect"><mdy-control-multiselect [field]="form.f.b" [options]="options" [searchable]="true" [ariaLabel]="'B'" /></div>
      <div id="datepicker"><mdy-control-datepicker [field]="form.f.c" [ariaLabel]="'C'" /></div>
      <div id="daterange"><mdy-control-daterange [field]="form.f.d" [ariaLabel]="'D'" /></div>
      <div id="timepicker"><mdy-control-timepicker [field]="form.f.e" [ariaLabel]="'E'" /></div>
      <div id="colors"><mdy-control-colors [field]="form.f.g" [ariaLabel]="'G'" /></div>
    </mdy-form>
  `,
})
class HostComponent {
  readonly options = [{ value: "a", label: "A" }];
  readonly form = mdyForm({
    a: field<string | null>(null),
    b: field<readonly string[]>([]),
    c: field<string | null>(null),
    d: field<unknown>(null),
    e: field<string | null>(null),
    g: field(""),
  });
}

const OPENING_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];

describe("a key pressed with the platform's modifier held", () => {
  const demonstrated: string[] = [];

  const openerIn = (scope: HTMLElement, kind: string): HTMLElement | null => {
    const part = (MDY_POPUP_OPENERS as Record<string, { opener: string }>)[kind]?.opener ?? "";
    const declared = partClasses(kind as never, part as never) as unknown;
    const classes = (declared as { classes?: readonly string[] })?.classes ?? (declared as readonly string[]) ?? [];
    for (const name of classes) {
      const found = scope.querySelector(`.${name}`);
      if (found !== null) return found as HTMLElement;
    }
    return null;
  };

  for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
    it(`${kind}: a key that opens it does not open it with the modifier held`, () => {
      for (const key of OPENING_KEYS) {
        for (const held of [{}, { metaKey: true }, { ctrlKey: true }]) {
          const fixture = TestBed.createComponent(HostComponent);
          fixture.detectChanges();
          const scope = (fixture.nativeElement as HTMLElement).querySelector(`#${kind}`) as HTMLElement;
          const opener = openerIn(scope, kind);
          expect(opener).not.toBeNull();

          opener?.focus();
          opener?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
          fixture.detectChanges();
          const opened = scope.querySelector("[aria-expanded='true']") !== null;

          if (Object.keys(held).length === 0) {
            if (opened) demonstrated.push(`${kind} ${key === " " ? "Space" : key}`);
            continue;
          }
          expect(`${kind} ${key} ${Object.keys(held)[0]} opened=${opened}`)
            .toBe(`${kind} ${key} ${Object.keys(held)[0]} opened=false`);
        }
      }
    });
  }

  it("Escape closes whatever is held with it, and the catalogue is what says so", () => {
    // The rule is not symmetrical with the one above, and the asymmetry is the decision: a gesture
    // that *adds* is refused under the accelerator, one that *removes* is honoured whatever is held.
    // Answering a dismissal wrongly costs a reopen; refusing one leaves somebody inside a panel with
    // the way out not working, under a modifier nobody thinks to test.
    //
    // Read from the contract as well as performed, because every renderer here closed on a modified
    // Escape *and kept closing with the declaration deleted* — each compared the key by hand. The
    // behaviour was theirs rather than the contract's, and the next renderer had no reason to agree.
    for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
      const escape = (MDY_WIDGET_KEYBOARD as Record<string, ReadonlyArray<{ key: string; when?: string; modifier?: string }>>)[kind]
        ?.find((binding) => binding.key === "Escape" && binding.when === "open");
      expect(`${kind}: ${escape?.modifier ?? "no way out declared"}`).toBe(`${kind}: any`);
    }
  });

  it("and a bare press really does open something here", () => {
    // The anti-tautology control for the whole file: if nothing opens, every refusal above is a
    // renderer answering no key at all, which would satisfy them and satisfy nobody using it.
    expect(demonstrated.length).toBeGreaterThanOrEqual(4);
  });
});
