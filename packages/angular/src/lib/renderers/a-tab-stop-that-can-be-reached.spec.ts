import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdySegmentedButtonComponent } from "./segmented-button/segmented-button-renderer.component";

type Option = { readonly value: string; readonly label: string; readonly disabled?: boolean };

/**
 * The segmented control's single tab stop.
 *
 * A browser skips a disabled control when tabbing, so a stop placed on one leaves the whole group
 * unreachable from the keyboard. The stop goes to the checked option when it is enabled, otherwise
 * to the first enabled option, and a group with nothing enabled has none.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdySegmentedButtonComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-segmented [field]="form.f.s" [options]="options()" [ariaLabel]="'Plan'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly options = signal<readonly Option[]>([]);
  readonly form = mdyForm({ s: field<string | null>(null) });
}

function stops(options: readonly Option[], held: string | null): (string | null)[] {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.options.set(options);
  fixture.componentInstance.form.f.s.set(held);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map((input) =>
    input.getAttribute("tabindex"),
  );
}

const A = { value: "a", label: "A" };
const B = { value: "b", label: "B" };
const C = { value: "c", label: "C" };

describe("the tab stop of a segmented control with options switched off", () => {
  it("rests on the first enabled option when the first is disabled and nothing is chosen", () => {
    expect(stops([{ ...A, disabled: true }, B, C], null)).toEqual(["-1", "0", "-1"]);
  });

  it("rests on the first enabled option when the chosen one is disabled", () => {
    expect(stops([A, { ...B, disabled: true }, C], "b")).toEqual(["0", "-1", "-1"]);
  });

  it("rests on the chosen option when it is enabled", () => {
    expect(stops([{ ...A, disabled: true }, B, C], "c")).toEqual(["-1", "-1", "0"]);
  });

  it("has no tab stop when every option is disabled", () => {
    expect(stops([{ ...A, disabled: true }, { ...B, disabled: true }], null)).toEqual(["-1", "-1"]);
  });
});
