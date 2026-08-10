import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";

/**
 * A control that never reached a form.
 *
 * The failure is certain either way — a control writes into the form that encloses it, and without
 * one there is nothing to write into. What is asserted here is the message: which control, and
 * which field it was bound to, so the one that is outside can be found in a template full of ones
 * that are not.
 */
@Component({
  standalone: true,
  imports: [MdyTextComponent],
  template: `<mdy-control-text name="email" [ariaLabel]="'Email'" />`,
})
class OutsideAnyFormComponent {}

describe("a control outside a form", () => {
  it("names itself and the field it was bound to", () => {
    const fixture = TestBed.createComponent(OutsideAnyFormComponent);

    expect(() => fixture.detectChanges()).toThrow(
      /<mdy-control-text> bound to "email" is outside a form/,
    );
  });

  it("says what to do about it", () => {
    const fixture = TestBed.createComponent(OutsideAnyFormComponent);

    expect(() => fixture.detectChanges()).toThrow(/descendant of <mdy-form>/);
  });
});
