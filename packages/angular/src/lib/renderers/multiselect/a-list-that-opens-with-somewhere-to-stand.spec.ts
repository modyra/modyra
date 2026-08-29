import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * Where the keyboard stands the moment the list is shown. ADR 0179.
 *
 * A panel raised from a key is about to be given a keypress, so it opens with somewhere for that
 * press to land — the cursor on the first value already chosen, else the first option on screen.
 * Opened with nothing singled out, the first arrow was spent picking a starting point, which shows
 * nothing and is indistinguishable by ear from an arrow that did not work; and the key meaning
 * "choose this one" had no target at all, so this renderer answered it at the trigger instead.
 *
 * The reference is read from the **element that holds focus**. One sitting on the trigger while the
 * person is standing somewhere else names a thing to nobody.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options()" [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ tags: field<readonly string[]>(["drinks"]) });
  readonly options = signal([
    { value: "food", label: "Food" },
    { value: "drinks", label: "Drinks" },
    { value: "other", label: "Other" },
  ]);
}

/** The same field with a filter box over its options, which moves where the keyboard belongs. */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect [field]="form.f.tags" [options]="options()" [searchable]="true" [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class FilterableHostComponent {
  readonly form = mdyForm({ tags: field<readonly string[]>(["drinks"]) });
  readonly options = signal([
    { value: "food", label: "Food" },
    { value: "drinks", label: "Drinks" },
    { value: "other", label: "Other" },
  ]);
}

describe("a multiselect list opened from the keyboard", () => {
  const trigger = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector<HTMLElement>(".mdy-multiselect__trigger");

  async function opened(host: typeof HostComponent | typeof FilterableHostComponent) {
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    const control = trigger(fixture);
    expect(control).not.toBeNull();
    control!.focus();
    control!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, control: control! };
  }

  it("moves the keyboard onto the value already chosen, not the top of the list", async () => {
    const { control } = await opened(HostComponent);

    expect(control.getAttribute("aria-expanded")).toBe("true");
    // No filter box, so the cursor and focus are the same thing: there is no element to carry a
    // reference from, and a control announcing a choice it does not hold focus for says nothing.
    const standing = document.activeElement as HTMLElement | null;
    expect(standing).not.toBe(control);
    // The value this person already holds. Landing at the top would make them walk to the thing
    // they opened the field to change.
    expect(standing?.closest("[data-option-key]")?.textContent ?? standing?.textContent ?? "")
      .toContain("Drinks");
  });

  it("with a filter box the keyboard stays in it and the choice is named from there", async () => {
    const { root } = await opened(FilterableHostComponent);

    const search = root.querySelector<HTMLElement>(".mdy-multiselect-overlay__input");
    expect(search).not.toBeNull();
    // The typing happens here, so this is where focus belongs — and therefore where the reference
    // has to be. One sitting on the trigger while the person is standing in the box names a thing
    // to nobody.
    const named = search!.getAttribute("aria-activedescendant");
    expect(named).toBeTruthy();
    // Resolved in the document, not in the component: a reference is followed by id from wherever
    // the panel was put, and this one is portalled out of the field.
    expect(document.getElementById(named!)).not.toBeNull();
  });
});
