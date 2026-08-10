import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";

/**
 * A handle from one form, inside another form's element.
 *
 * `[field]` names a path, and the state behind that path used to be resolved against whichever form
 * encloses the control. Two forms on one page — a dialog over a list is the ordinary case — then
 * share every path they happen to have in common, and what the user types goes to the wrong one
 * with nothing said.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="host">
      <mdy-control-text [field]="guest.f.name" [ariaLabel]="'Name'" />
    </mdy-form>
  `,
})
class MisplacedControlComponent {
  readonly host = mdyForm({ name: field("host value") });
  readonly guest = mdyForm({ name: field("guest value") });
}

describe("a control bound to another form's handle", () => {
  it("does not silently write into the enclosing form", () => {
    const fixture = TestBed.createComponent(MisplacedControlComponent);
    fixture.detectChanges();
    const { host, guest } = fixture.componentInstance;
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

    // What it shows says which form it is bound to.
    expect(input.value).toBe("guest value");

    input.value = "typed";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    expect(guest.value().name).toBe("typed");
    expect(host.value().name).toBe("host value");
  });
});
