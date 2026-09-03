import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { focusPartOnOpen, partClasses } from "@modyra/widgets";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * Opening a panel puts focus on the thing the panel was opened to operate.
 *
 * This renderer already did it for a multiselect with a filter box and not for one without: the
 * panel opened and focus stayed on the trigger, while every other panel in the library moved it.
 * The contract now names the part for both, and this asserts the part is where focus went. ADR 0197.
 *
 * **The configuration is named beside every assertion**, because the answer depends on it — a filter
 * box when there is one, the first option when there is not. Two runs that differ in configuration
 * and are read as one answer are how three renderers looked like three opinions when two of them
 * were being asked a different question.
 *
 * **And the landing is asserted, not the press.** The trigger is focused first, because a press
 * leaves it there and this environment does not; the panel is asserted open before focus is read,
 * because focus after a panel that never opened says nothing at all.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect
        [field]="form.f.where"
        [options]="options"
        [searchable]="searchable()"
        [ariaLabel]="'Where'" />
    </mdy-form>
  `,
})
class Host {
  readonly form = mdyForm({ where: field<readonly string[]>([]) });
  readonly options = [{ value: "x", label: "X" }, { value: "y", label: "Y" }];
  readonly searchable = signal(false);
}

describe("a multiselect panel", () => {
  function open(searchable: boolean): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.searchable.set(searchable);
    fixture.detectChanges();

    const opener = fixture.nativeElement.querySelector("[aria-expanded]") as HTMLElement | null;
    expect(opener).toBeTruthy();
    opener!.focus();
    expect(document.activeElement).toBe(opener);
    opener!.click();
    fixture.detectChanges();
    expect(opener!.getAttribute("aria-expanded")).toBe("true");
    return opener!;
  }

  for (const searchable of [false, true]) {
    it(`with searchable=${searchable}, opens on the part the contract names`, () => {
      open(searchable);
      const part = focusPartOnOpen("multiselect", { searchable })!;
      const expected = partClasses("multiselect", part as never)[0];
      // The contract names a part that carries at least one class; without this the assertion below
      // would compare against `undefined` and pass on an element that carries no class at all.
      expect(typeof expected).toBe("string");

      const landed = document.activeElement as HTMLElement;
      expect(landed).not.toBe(document.body);
      expect(landed.classList.contains(expected!)).toBe(true);

      // The class alone cannot tell the two apart, and the two are the whole decision: an option in
      // the panel and a chip in the strip both carry `mdy-chip`, and a chip removes a value rather
      // than offering one. Asserted by where the element sits, which is what differs.
      if (part === "option") {
        const containers = partClasses("multiselect", "options" as never);
        expect(containers.some((cls) => landed.closest(`.${cls}`) !== null)).toBe(true);
        expect(landed.classList.contains("mdy-chip--value")).toBe(false);
      }
    });
  }
});
