import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyTextComponent } from "./text-renderer.component";

/**
 * A text-like control asks the platform for the input its kind declares.
 *
 * `text`, `email` and `password` share one anatomy and differ in exactly one thing: the native input
 * they want. The contract states it — `controlType` — and this component used to ignore it, taking
 * the answer from an input a host wrote by hand and defaulting to `"text"` when the host wrote
 * nothing.
 *
 * The cost was silent. An email field whose author forgot the attribute rendered as plain text: no
 * email keyboard on a phone, none of the platform's own handling, and nothing anywhere saying so.
 * That is the shape asserted against — not a crash, a quiet downgrade.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.a" [kind]="kind" [ariaLabel]="'A'" />
      <mdy-control-text [field]="form.f.b" [ariaLabel]="'B'" />
      <mdy-control-text [field]="form.f.c" kind="email" type="url" [ariaLabel]="'C'" />
    </mdy-form>
  `,
})
class HostComponent {
  kind: "text" | "email" | "password" = "text";
  readonly form = mdyForm({ a: field(""), b: field(""), c: field("") });
}

const typesOf = (fixture: { nativeElement: HTMLElement }): string[] =>
  Array.from(fixture.nativeElement.querySelectorAll("input")).map((input) => input.getAttribute("type") ?? "");

describe("the kind decides the native input", () => {
  for (const kind of ["text", "email", "password"] as const) {
    it(`${kind}: asks for the input the contract declares`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.kind = kind;
      fixture.detectChanges();

      // Read from the catalogue rather than spelled here: a kind whose declaration moves takes this
      // expectation with it, instead of leaving a copy behind to disagree.
      const declared = MDY_WIDGET_CONTRACTS[kind].controlType;
      expect(declared).toBeTruthy();
      expect(typesOf(fixture)[0]).toBe(declared);
    });
  }

  it("a host that names no kind still gets a text input", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    // The default a host had before the kind could be named, kept: nothing that worked stops working.
    expect(typesOf(fixture)[1]).toBe("text");
  });

  it("an explicit type is still the host's to give", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    // The catalogue answers when nobody said otherwise; it does not overrule a host with a reason
    // the catalogue does not know.
    expect(typesOf(fixture)[2]).toBe("url");
  });
});
