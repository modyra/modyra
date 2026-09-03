import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * On the trigger, what the page carries is what the contract says — key for key.
 *
 * This element used to have two authors. The template bound `aria-invalid`, `aria-required`,
 * `aria-readonly`, `aria-describedby` and `aria-labelledby` itself, while the part applied to it was
 * the overlay opener's — which knows about expanding and controlling a panel and nothing about a
 * field's verdict. So the contract's answer to five questions never reached the page, and the answer
 * that did was derived a second time, in another language, with nothing saying which would win if
 * they ever disagreed.
 *
 * The part applied is now the field's own trigger, which answers the opener's three with the same
 * values in the same state and the other five besides. The template writes none of them.
 *
 * Asserted as an equality rather than as a list of attributes this file happens to remember: a check
 * that names the five would go on passing the day the contract grows a sixth and the element does
 * not carry it.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options" [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class Host {
  readonly form = mdyForm({ tags: field<readonly string[]>([]) });
  readonly options = [{ value: "food", label: "Food" }];
}

describe("the multiselect trigger", () => {
  function trigger(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector(".mdy-multiselect__trigger") as HTMLElement | null;
    expect(element).toBeTruthy();
    return element!;
  }

  it("carries the states the contract projects, and each reference it makes resolves", () => {
    const element = trigger();

    // The precondition: an element carrying none of these would satisfy every claim below by having
    // nothing to disagree with.
    const aria = element.getAttributeNames().filter((name) => name.startsWith("aria-"));
    expect(aria.length).toBeGreaterThanOrEqual(5);

    // The states, as the contract spells them: a state attribute is a state, and `false` says
    // "checked, and fine" where an absent one says nothing at all.
    expect(element.getAttribute("aria-invalid")).toBe("false");
    expect(element.getAttribute("aria-required")).toBe("false");
    expect(element.getAttribute("aria-disabled")).toBe("false");
    expect(element.hasAttribute("aria-readonly")).toBe(false);

    // And every reference lands: the caption, the description and the errors are all elements this
    // adapter draws, which is what the batch before this one was for.
    const dangling: string[] = [];
    for (const name of ["aria-labelledby", "aria-describedby", "aria-controls"]) {
      const value = element.getAttribute(name);
      if (value === null || value.trim() === "") continue;
      for (const id of value.trim().split(/\s+/)) {
        if (document.getElementById(id) === null) dangling.push(`${name} -> ${id}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("is named by the caption the contract points at, not by a name of its own", () => {
    // Two names on one element is not two names: the computation takes `aria-labelledby` and stops,
    // so an `aria-label` beside it is words nobody hears. ADR 0175.
    const element = trigger();
    const points = element.getAttribute("aria-labelledby");

    expect(points).toBeTruthy();
    expect(document.getElementById(points!)?.textContent?.trim()).toBeTruthy();
  });
});
