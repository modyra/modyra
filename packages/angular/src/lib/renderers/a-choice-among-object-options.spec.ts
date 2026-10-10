import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "./segmented-button/segmented-button-renderer.component";

interface Plan {
  readonly id: number;
}

const FREE: Plan = { id: 1 };
const TEAM: Plan = { id: 2 };
const SCALE: Plan = { id: 3 };

/**
 * A choice among options whose values are objects.
 *
 * `String()` renders every plain object as `[object Object]`, so a key derived through it is one
 * key for the whole list: picking an option selects whichever the controller indexed last, and a
 * held value either marks every option or none. Identity is no better for the held side — a draft
 * or a refetch hands the field a fresh object that is an option's value without being the same
 * reference. An option can also be switched off on its own while the field stays live.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyRadioGroupComponent, MdySegmentedButtonComponent],
  template: `
    <mdy-form [form]="form">
      <div id="radio"><mdy-control-radio [field]="form.f.r" [options]="options" [ariaLabel]="'Plan'" /></div>
      <div id="segmented"><mdy-control-segmented [field]="form.f.s" [options]="options" [ariaLabel]="'Plan'" /></div>
    </mdy-form>
  `,
})
class HostComponent {
  readonly options = [
    { value: FREE, label: "Free" },
    { value: TEAM, label: "Team", disabled: true },
    { value: SCALE, label: "Scale" },
  ];
  readonly form = mdyForm({
    r: field<Plan | null>(null),
    s: field<Plan | null>(null),
  });
}

const KINDS = ["radio", "segmented"] as const;

function mount() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const inputs = (kind: (typeof KINDS)[number]) =>
    Array.from(root.querySelectorAll<HTMLInputElement>(`#${kind} input[type="radio"]`));
  const settle = () => {
    fixture.detectChanges();
  };
  return { fixture, root, inputs, settle };
}

describe("a radio group and a segmented control over object-valued options", () => {
  for (const kind of KINDS) {
    const slot = kind === "radio" ? "r" : "s";

    it(`${kind}: marks only the option a structurally equal value belongs to`, () => {
      const { fixture, inputs, settle } = mount();
      const form = fixture.componentInstance.form as unknown as { f: Record<string, { set(v: unknown): void }> };
      form.f[slot]!.set({ id: 3 });
      settle();
      expect(inputs(kind).map((input) => input.checked)).toEqual([false, false, true]);
    });

    it(`${kind}: marks only the option the same object belongs to`, () => {
      const { fixture, inputs, settle } = mount();
      const form = fixture.componentInstance.form as unknown as { f: Record<string, { set(v: unknown): void }> };
      form.f[slot]!.set(FREE);
      settle();
      expect(inputs(kind).map((input) => input.checked)).toEqual([true, false, false]);
    });

    it(`${kind}: choosing an option stores that option's value, not the last one indexed`, () => {
      const { fixture, inputs, settle } = mount();
      const handle = (fixture.componentInstance.form.f as Record<string, { value(): unknown }>)[slot]!;
      const first = inputs(kind)[0]!;
      first.checked = true;
      first.dispatchEvent(new Event("change", { bubbles: true }));
      settle();
      expect(handle.value()).toEqual(FREE);
    });

    it(`${kind}: an option switched off is disabled on its own, the others stay live`, () => {
      const { inputs } = mount();
      expect(inputs(kind).map((input) => input.disabled)).toEqual([false, true, false]);
    });
  }

  it("radio: the switched-off option's row wears the disabled class", () => {
    const { inputs } = mount();
    const rows = inputs("radio").map((input) => input.closest("label") as HTMLLabelElement);
    expect(rows.map((row) => row.classList.contains("mdy-radio-item--disabled"))).toEqual([false, true, false]);
  });

  it("segmented: an arrow steps over a switched-off option", () => {
    const { fixture, root, inputs, settle } = mount();
    const handle = (fixture.componentInstance.form.f as Record<string, { value(): unknown }>)["s"]!;
    const form = fixture.componentInstance.form as unknown as { f: Record<string, { set(v: unknown): void }> };
    form.f["s"]!.set(FREE);
    settle();
    const track = root.querySelector("#segmented [role=radiogroup]") as HTMLElement;
    track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    settle();
    expect(handle.value()).toEqual(SCALE);
    expect(inputs("segmented").map((input) => input.checked)).toEqual([false, false, true]);

    track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    settle();
    expect(handle.value()).toEqual(FREE);
  });

  it("segmented: the roving tab stop never rests on a switched-off option", () => {
    const { inputs } = mount();
    const stops = inputs("segmented").map((input) => input.getAttribute("tabindex"));
    expect(stops).toEqual(["0", "-1", "-1"]);
  });
});
