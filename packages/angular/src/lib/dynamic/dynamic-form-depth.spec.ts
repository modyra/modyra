/**
 * How deep a bound layout may go, and what happens at the level past it.
 *
 * The limit itself is `MDY_LAYOUT_MAX_DEPTH` and its reasoning is ADR 0160. What this file fixes is
 * the *shape* of the refusal for a structure bound from a template, which is neither of the two
 * shapes the framework already had.
 *
 * A function call gets a `throw`: its caller is code, in a position to catch, and silence is the
 * only failure it could not notice. An input is not that. There is nowhere in a template to catch,
 * so raising takes the whole view down — the questions go with the arrangement — and in an
 * application the exception reaches whatever error handler is installed, which swallowed it and left
 * a form claiming to be mounted with no structure and nothing said.
 *
 * So a bound layout is refused the way a document is: the arrangement is dropped, the questions
 * still reach the person, and the reason is stated where a developer looks.
 */
import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_LAYOUT_CLASSES } from "@modyra/widgets";
import { MDY_LAYOUT_MAX_DEPTH, type MdyDynamicField, type MdyDynamicLayoutNode } from "@modyra/core";
import { MdyDynamicFormComponent } from "./mdy-dynamic-form.component";

/** One question per level, each inside the branch above it. */
const chain = (depth: number): { fields: MdyDynamicField[]; layout: MdyDynamicLayoutNode[] } => {
  const fields: MdyDynamicField[] = [];
  for (let i = 1; i <= depth; i += 1) fields.push({ name: `q${i}`, kind: "text", label: `Q${i}` });
  let node: MdyDynamicLayoutNode = { kind: "section", id: `s${depth}`, children: [`q${depth}`] };
  for (let i = depth - 1; i >= 1; i -= 1) {
    node = { kind: "section", id: `s${i}`, children: [`q${i}`, node] };
  }
  return { fields, layout: [node] };
};

@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form [fields]="fields()" [layout]="layout()" />`,
})
class DepthHost {
  fields = signal<MdyDynamicField[]>([]);
  layout = signal<MdyDynamicLayoutNode[]>([]);
}

function mount(depth: number) {
  const said: string[] = [];
  const spy = jest.spyOn(console, "warn").mockImplementation((...parts) => { said.push(parts.join(" ")); });
  const fixture = TestBed.createComponent(DepthHost);
  const { fields, layout } = chain(depth);
  fixture.componentInstance.fields.set(fields);
  fixture.componentInstance.layout.set(layout);
  fixture.detectChanges();
  spy.mockRestore();
  const host: HTMLElement = fixture.nativeElement;
  return {
    said,
    sections: host.querySelectorAll(`.${MDY_LAYOUT_CLASSES.section}`).length,
    inputs: host.querySelectorAll("input").length,
  };
}

describe("MdyDynamicFormComponent, a bound layout and the depth limit", () => {
  it("arranges a structure at the limit, and says nothing about it", () => {
    const held = mount(MDY_LAYOUT_MAX_DEPTH);

    // The control case, and it is what stops the next assertion being free: a component that
    // arranged nothing at any depth would pass "past the limit, nothing is arranged" perfectly.
    expect(held.sections).toBe(MDY_LAYOUT_MAX_DEPTH);
    expect(held.inputs).toBe(MDY_LAYOUT_MAX_DEPTH);
    expect(held.said).toEqual([]);
  });

  it("past the limit, drops the arrangement, keeps the questions, and says why", () => {
    const held = mount(MDY_LAYOUT_MAX_DEPTH + 1);

    expect(held.sections).toBe(0);
    // The half that matters most and is easiest to lose: a person still gets the form. Raising here
    // took the questions down with the structure.
    expect(held.inputs).toBe(MDY_LAYOUT_MAX_DEPTH + 1);
    expect(held.said).toHaveLength(1);
    // The depth, the place and the reason. A refusal naming only the rule leaves somebody hunting
    // for which of their sections is the one past it.
    expect(held.said[0]).toContain(`${MDY_LAYOUT_MAX_DEPTH + 1} levels deep`);
    expect(held.said[0]).toContain("/layout/0/children");
  });
});
