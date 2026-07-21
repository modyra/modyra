import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyDynamicField } from "@modyra/core";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyDynamicFormComponent } from "./mdy-dynamic-form.component";

@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form [fields]="fields" />`,
})
class DynamicHost {
  fields: ReadonlyArray<MdyDynamicField> = [
    {
      name: "plan",
      kind: "select",
      label: "Plan",
      options: [
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
      ],
    },
    {
      name: "tags",
      kind: "multiselect",
      label: "Tags",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    },
  ];
}

function dynamicForm(): {
  fixture: ReturnType<typeof TestBed.createComponent<DynamicHost>>;
  form: MdyFormComponent<Record<string, unknown>>;
} {
  const fixture = TestBed.createComponent(DynamicHost);
  fixture.detectChanges();
  const component = fixture.debugElement.children[0]!
    .componentInstance as MdyDynamicFormComponent;
  return { fixture, form: component.form() };
}

describe("MdyDynamicFormComponent option whitelisting", () => {
  it("a scripted value outside the select options is invalid", () => {
    const { form } = dynamicForm();
    // The Reddit case: the select offers "one"/"two" — "three" must fail.
    form.getField("plan")!().value.set("three");
    expect(form.state.valid()).toBe(false);
    expect(
      form.errorsFor("plan")().some((e) => e.message.includes("one of")),
    ).toBe(true);

    form.getField("plan")!().value.set("one");
    expect(form.errorsFor("plan")()).toEqual([]);
  });

  it("a multiselect rejects arrays containing unknown options", () => {
    const { form } = dynamicForm();
    form.getField("tags")!().value.set(["a", "b"]);
    expect(form.errorsFor("tags")()).toEqual([]);

    form.getField("tags")!().value.set(["a", "x"]);
    expect(form.state.valid()).toBe(false);
    form.getField("tags")!().value.set([]);
    expect(form.errorsFor("tags")()).toEqual([]); // empty passes
  });

  it("configured validators still apply alongside the whitelist", () => {
    const fixture = TestBed.createComponent(DynamicHost);
    fixture.componentInstance.fields = [
      {
        name: "plan",
        kind: "select",
        label: "Plan",
        validators: { required: true },
        options: [
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
        ],
      },
    ];
    fixture.detectChanges();
    const component = fixture.debugElement.children[0]!
      .componentInstance as MdyDynamicFormComponent;
    const form = component.form();

    // Null: required fires (oneOf passes empties through by design).
    expect(form.state.valid()).toBe(false);
    form.getField("plan")!().value.set("three");
    expect(form.state.valid()).toBe(false); // whitelist fires
    form.getField("plan")!().value.set("two");
    expect(form.state.valid()).toBe(true);
  });
});
