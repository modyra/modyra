import { Component, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_CONTRACTS, datepickerFieldPartIds, daterangeFieldPartIds } from "@modyra/widgets";
import type { MdyDateRange } from "@modyra/core";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyDatePickerComponent } from "./datepicker.component";
import { MdyDateRangePickerComponent } from "./daterange-renderer.component";

/**
 * The day grid is named by the month it shows, by referring to the heading that says so.
 *
 * `aria-labelledby` wins the name computation over `aria-label` always, so a grid carrying both is
 * named by the reference whatever the written caption says. The name is therefore asserted the way
 * a reader computes it: the reference resolves to one element, that element's text is the month,
 * and no written label sits beside the reference. The referenced element is the title *inside* the
 * view-toggle button and not the button — the button carries a name of its own, and a reference
 * crossing into it would name the grid with the way out. ADR 0212.
 *
 * Both kinds: the range shares the header component and drew its grid with its own written label.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyDatePickerComponent],
  template: `<mdy-form [form]="form"><mdy-control-datepicker [field]="form.f.d" [ariaLabel]="'D'" /></mdy-form>`,
})
class DateHost { readonly form = mdyForm({ d: field<string | null>(null) }); }

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyDateRangePickerComponent],
  template: `<mdy-form [form]="form"><mdy-control-daterange [field]="form.f.d" [ariaLabel]="'D'" /></mdy-form>`,
})
class RangeHost { readonly form = mdyForm({ d: field<MdyDateRange | null>(null) }); }

const CASES: ReadonlyArray<{ kind: "datepicker" | "daterange"; host: Type<unknown>; partIds: (id: string) => { headingId: string } }> = [
  { kind: "datepicker", host: DateHost, partIds: datepickerFieldPartIds },
  { kind: "daterange", host: RangeHost, partIds: daterangeFieldPartIds },
];

const classOf = (kind: "datepicker" | "daterange", part: string): string =>
  `.${(MDY_WIDGET_CONTRACTS[kind].parts as Record<string, { classes: readonly string[] }>)[part]!.classes.join(".")}`;

for (const { kind, host, partIds } of CASES) {
  describe(`${kind}: what the calendar grid is called`, () => {
    function openCalendar(): HTMLElement {
      const fixture = TestBed.createComponent(host);
      fixture.detectChanges();
      const opener = (fixture.nativeElement.querySelector("[aria-haspopup]")
        ?? fixture.nativeElement.querySelector("[aria-expanded]")) as HTMLElement;
      opener.focus();
      opener.click();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it("is named by referring to the month heading, and by nothing else", () => {
      const root = openCalendar();
      const grid = root.querySelector(classOf(kind, "grid")) as HTMLElement | null;
      expect(grid).toBeTruthy();
      // The widget's id is the component's business, so it is read back from the grid the contract
      // names rather than guessed.
      expect(grid!.id).toMatch(/__grid$/);
      const { headingId } = partIds(grid!.id.replace(/__grid$/, ""));
      expect(grid!.getAttribute("aria-labelledby")).toBe(headingId);
      expect(grid!.getAttribute("aria-label")).toBeNull();
      const heading = document.getElementById(headingId);
      expect(heading).toBeTruthy();
      expect(heading!.textContent!.trim()).toMatch(/^\p{L}+ \d{4}$/u);
    });

    it("refers to the title inside the view toggle, not the toggle", () => {
      const root = openCalendar();
      const grid = root.querySelector(classOf(kind, "grid")) as HTMLElement;
      const heading = document.getElementById(partIds(grid.id.replace(/__grid$/, "")).headingId)!;
      expect(heading.matches(classOf(kind, "headerTitle"))).toBe(true);
      const toggle = heading.closest(classOf(kind, "viewToggle")) as HTMLElement | null;
      expect(toggle).toBeTruthy();
      expect(toggle!.tagName).toBe("BUTTON");
      expect(toggle!.getAttribute("aria-label")).not.toBeNull();
      const header = toggle!.parentElement!;
      expect(Array.from(header.children, (child) => child.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON"]);
      expect(header.children[0]!.matches(classOf(kind, "headerPrevious"))).toBe(true);
      expect(header.children[2]!.matches(classOf(kind, "headerNext"))).toBe(true);
    });
  });
}
