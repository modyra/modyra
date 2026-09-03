import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { partClasses, stateClass } from "@modyra/widgets";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * Where the keyboard is standing in an open list is something a reader is told.
 *
 * A cursor that exists only as a class has moved for everyone who can see the screen and for nobody
 * else. There are two honest ways to say it, and ARIA allows both: put real focus on the option, so
 * the focused element *is* the cursor; or keep focus where a person is typing and name the option
 * with `aria-activedescendant`. This kind uses each in a different configuration, which is why the
 * claim below is the disjunction rather than either half.
 *
 * **The reference is asserted to resolve to the option under the cursor, never merely to be there** —
 * a dangling IDREF reads as correct in every markup dump and points assistive technology at nothing —
 * **and it is read from the element that holds focus**, because a reference on an element nobody is
 * standing on is never consulted.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect
        [field]="form.f.t"
        [options]="options"
        [mode]="mode()"
        [searchable]="searchable()"
        [ariaLabel]="'T'" />
    </mdy-form>`,
})
class Host {
  readonly form = mdyForm({ t: field<readonly string[]>([]) });
  readonly options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  readonly mode = signal<"single" | "multi">("single");
  readonly searchable = signal(false);
}

const OPTION = partClasses("multiselect", "option" as never)[0]!;
const CURSOR = stateClass(OPTION, "active");

describe("the keyboard's position in an open list", () => {
  for (const [mode, searchable] of [["single", false], ["multi", false], ["multi", true]] as const) {
    it(`mode=${mode} searchable=${searchable}: is announced, one way or the other`, () => {
      const fixture = TestBed.createComponent(Host);
      fixture.componentInstance.mode.set(mode);
      fixture.componentInstance.searchable.set(searchable);
      fixture.detectChanges();

      const trigger = fixture.nativeElement.querySelector("[aria-expanded]") as HTMLElement;
      trigger.focus();
      trigger.click();
      fixture.detectChanges();
      expect(trigger.getAttribute("aria-expanded")).toBe("true");

      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      fixture.detectChanges();

      // The precondition, and it is the subject: a cursor exists on the page at all.
      const cursor = document.querySelector(`.${CURSOR}`);
      expect(cursor).toBeTruthy();
      expect(cursor!.id).toBeTruthy();

      const holder = document.activeElement as HTMLElement;
      expect(holder).not.toBe(document.body);

      const named = holder.getAttribute("aria-activedescendant");
      const isCursorItself = holder === cursor;
      expect(isCursorItself || named !== null).toBe(true);

      if (!isCursorItself) {
        const target = document.getElementById(named!);
        expect(target).toBeTruthy();
        expect(target).toBe(cursor);
      }
    });
  }
});
