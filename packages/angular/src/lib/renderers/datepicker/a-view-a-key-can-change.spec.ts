import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_KEYBOARD, partClasses } from "@modyra/widgets";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyDatePickerComponent } from "./datepicker.component";

/**
 * The calendar's other views can be reached from a keyboard.
 *
 * The months and years views are opened by a button in the header, and no key declared a change of
 * view at all: every intent this kind declares while open moves *within* the view being shown. So
 * the act behind that button was operable with a pointer and with nothing else — the species ADR
 * 0198 names, not the affordance the month arrows are. ADR 0199.
 *
 * **Asserted by pressing the gesture and reading where focus is, not by reading the view's state.**
 * A view that changed while the keyboard stayed on a cell the render has taken away is not a view a
 * person reached: the next press goes to the document.
 *
 * The gesture is the platform's accelerator, taken from the declaration rather than named here —
 * this is the first binding outside `undo` to use it, so a spec spelling `Ctrl` would pass on one
 * platform and measure nothing on the other.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyDatePickerComponent],
  template: `<mdy-form [form]="form"><mdy-control-datepicker [field]="form.f.d" [ariaLabel]="'D'" /></mdy-form>`,
})
class Host { readonly form = mdyForm({ d: field<string | null>(null) }); }

const CELL: Record<string, string> = {
  days: partClasses("datepicker", "gridcell" as never)[0]!,
  months: partClasses("datepicker", "monthCell" as never)[0]!,
  years: partClasses("datepicker", "yearCell" as never)[0]!,
};
// Both accelerators, and that is the measurement rather than a convenience. `primary` is documented
// as the platform's own — `Cmd` where the platform uses it, `Ctrl` elsewhere — but the matcher
// accepts either on every platform, so pressing only the one this machine happens to use would leave
// the other declared and unexercised.
const ACCELERATORS: readonly Record<string, boolean>[] = [{ ctrlKey: true }, { metaKey: true }];

function zoomKeys(): { out: string; back: string } {
  const declared = MDY_WIDGET_KEYBOARD.datepicker.filter((one) => one.intent === "view" && one.when === "open");
  const out = declared.find((one) => one.by === 1);
  const back = declared.find((one) => one.by === -1);
  expect(out && back).toBeTruthy();
  expect(out!.modifier).toBe("primary");
  return { out: out!.key, back: back!.key };
}

describe("the views of a calendar", () => {
  beforeAll(() => {
    // Not a stand-in for the product: this renderer scrolls the chosen cell into view when it draws
    // the years, and the environment these specs run in has no such method on an element. Without
    // it the run throws on the way into that view and reports nothing about the step it was making.
    if (typeof Element.prototype.scrollIntoView !== "function") {
      Element.prototype.scrollIntoView = function scrollIntoView(): void { /* the environment has no scrolling */ };
    }
  });

  async function openCalendar(): Promise<(key: string, held?: Record<string, boolean>) => Promise<void>> {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const opener = (fixture.nativeElement.querySelector("[aria-haspopup]")
      ?? fixture.nativeElement.querySelector("[aria-expanded]")) as HTMLElement | null;
    expect(opener).toBeTruthy();
    opener!.focus();
    opener!.click();
    fixture.detectChanges();
    // The precondition: the calendar is showing its days and the keyboard is on one of them.
    expect((document.activeElement as HTMLElement | null)?.classList.contains(CELL.days!)).toBe(true);

    return async (key: string, held: Record<string, boolean> = {}): Promise<void> => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
  }

  const viewHoldingFocus = (): string => {
    const at = document.activeElement as HTMLElement | null;
    const found = Object.entries(CELL).find(([, cls]) => at?.classList.contains(cls));
    return found?.[0] ?? `nothing (.${at?.className ?? "?"})`;
  };

  it.each(ACCELERATORS)("the accelerator %p steps out to the months, then to the years, and the keyboard goes with it", async (accelerator) => {
    const press = await openCalendar();
    const { out } = zoomKeys();

    await press(out, accelerator);
    expect(viewHoldingFocus()).toBe("months");

    await press(out, accelerator);
    expect(viewHoldingFocus()).toBe("years");

    // Clamped, not wrapped: a ring would send a held key from the widest view straight back to the
    // narrowest and oscillate there.
    await press(out, accelerator);
    expect(viewHoldingFocus()).toBe("years");
  });

  it("and back in again, one view at a time", async () => {
    const press = await openCalendar();
    const { out, back } = zoomKeys();

    await press(out, ACCELERATORS[0]!);
    await press(out, ACCELERATORS[0]!);
    expect(viewHoldingFocus()).toBe("years");

    await press(back, ACCELERATORS[0]!);
    expect(viewHoldingFocus()).toBe("months");

    await press(back, ACCELERATORS[0]!);
    expect(viewHoldingFocus()).toBe("days");
  });
});
