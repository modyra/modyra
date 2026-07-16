import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm, MdyTypedForm } from "../core/typed-form";
import { MdyFormsDevtoolsComponent } from "./mdy-forms-devtools.component";

@Component({
  standalone: true,
  imports: [MdyFormsDevtoolsComponent],
  template: `
    <mdy-forms-devtools
      [form]="form"
      [maskFields]="['pin']"
      [excludeFields]="['internalId']"
      expanded
    />
  `,
})
class MaskingHostComponent {
  readonly form: MdyTypedForm<{
    email: ReturnType<typeof field<string>>;
    password: ReturnType<typeof field<string>>;
    pin: ReturnType<typeof field<string>>;
    internalId: ReturnType<typeof field<string>>;
  }> = mdyForm({
    email: field("a@b.co"),
    password: field("hunter2"),
    pin: field("0000"),
    internalId: field("id-42"),
  });
}

describe("MdyFormsDevtoolsComponent masking", () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(MaskingHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("masks sensitive-looking fields in rows and JSON view", () => {
    const el = render();
    const text = el.textContent ?? "";
    expect(text).toContain("a@b.co"); // normal values stay visible
    expect(text).not.toContain("hunter2"); // heuristic: path contains "password"
    expect(text).toContain("•••");
  });

  it("masks fields listed in [maskFields]", () => {
    const el = render();
    expect(el.textContent).not.toContain("0000");
  });

  it("hides fields listed in [excludeFields] from rows and JSON", () => {
    const el = render();
    expect(el.textContent).not.toContain("internalId");
    expect(el.textContent).not.toContain("id-42");
  });

  it("spells out the state column headers", () => {
    const el = render();
    const headers = Array.from(el.querySelectorAll("th")).map(
      (th) => th.textContent?.trim(),
    );
    expect(headers).toEqual([
      "field",
      "value",
      "valid",
      "touched",
      "dirty",
      "pending",
      "errors",
    ]);
  });
});
