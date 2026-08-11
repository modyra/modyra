import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { array, field, group, mdyForm, MdyTypedForm } from "../core/typed-form";
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

@Component({
  standalone: true,
  imports: [MdyFormsDevtoolsComponent],
  template: `
    <mdy-forms-devtools [form]="form" [excludeFields]="['users.0.internalId']" expanded />
  `,
})
class CollectionHostComponent {
  readonly form = mdyForm({
    users: array(
      group({
        email: field("row@b.co"),
        password: field("hunter2"),
        internalId: field("id-42"),
      }),
      { initial: [{ email: "row@b.co", password: "hunter2", internalId: "id-42" }] },
    ),
    tags: array(field(""), { initial: ["public", "visible"] }),
  });
}

describe("MdyFormsDevtoolsComponent masking inside a collection", () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(CollectionHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("masks a sensitive field inside a row, in the JSON view as well as the rows", () => {
    // The JSON view is the one that gets copied into a ticket. Left as a leaf, an array handed its
    // rows back whole and the password went with them.
    const text = render().textContent ?? "";
    expect(text).not.toContain("hunter2");
    expect(text).toContain("•••");
  });

  it("leaves an ordinary collection readable", () => {
    // A limit that hides everything protects nothing anyone would use.
    const text = render().textContent ?? "";
    expect(text).toContain("public");
    expect(text).toContain("visible");
    expect(text).toContain("row@b.co");
  });

  it("drops an excluded path that names a row's field", () => {
    const text = render().textContent ?? "";
    expect(text).not.toContain("id-42");
  });
});

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
