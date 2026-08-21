/**
 * A popup whose field left play while it was open.
 *
 * Nobody has to click anything for this: a sibling's `when` predicate takes a field out of play when
 * a value arrives from a fetch, and the popup that was open is still there. The click doing nothing
 * is right; the calendar still being there offering it is not — `closeOverlayWhenOutOfPlay` is the
 * contract's rule for exactly that, and it expresses the rule by writing the controller's `open`.
 *
 * So this measures whether the renderer paints the state the contract writes. It read the presence
 * of the dial once and was wrong to: this renderer keeps its panel in the DOM and toggles the
 * panel's visibility, so the face is there whether or not anyone can see or reach it.
 */
import { Component, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyMultiselectComponent } from "../renderers/multiselect/multiselect-renderer.component";
import { MdyTimepickerComponent } from "../renderers/timepicker/timepicker-renderer.component";
import { MdyFormComponent } from "../form/mdy-form.component";
import { field, mdyForm, type MdyTypedForm } from "./typed-form";

const SCHEMA = {
  mode: field<string>("on"),
  alarm: field<string | null>("09:30", [], {
    when: (_value, form) => (form as { mode?: string }).mode !== "off",
  }),
  tags: field<readonly string[]>([], [], {
    when: (_value, form) => (form as { mode?: string }).mode !== "off",
  }),
};

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent, MdyTimepickerComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-timepicker [field]="form.f.alarm" label="Alarm" format="24h" />
      <mdy-control-multiselect [field]="form.f.tags" label="Tags" [options]="options" [searchable]="true" />
    </mdy-form>
  `,
})
class Host {
  form!: MdyTypedForm<typeof SCHEMA>;
  readonly options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
}

describe("a popup whose field leaves play", () => {
  const mount = (opener: string) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.form = mdyForm(SCHEMA, { injector: TestBed.inject(Injector) });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLElement>(opener)!.click();
    fixture.detectChanges();
    return { fixture, host };
  };

  /**
   * Whether the popup is showing.
   *
   * Not the presence of the dial: this renderer keeps its panel in the DOM and toggles the panel's
   * visibility, so the face is there whether or not anyone can see or reach it. What moves is the
   * panel's visible class and what the opener announces.
   */
  const showing = (host: HTMLElement, opener: string) => ({
    panels: host.querySelectorAll(".mdy-overlay-panel--visible").length,
    announced: host.querySelector(opener)?.getAttribute("aria-expanded") ?? null,
  });

  it.each([
    ["timepicker", ".mdy-timepicker__toggle"],
    ["multiselect", ".mdy-multiselect__trigger"],
  ])("%s closes an open popup when the field leaves play", (_kind, opener) => {
    const { fixture, host } = mount(opener);
    expect(showing(host, opener)).toEqual({ panels: 1, announced: "true" });

    fixture.componentInstance.form.f.mode.set("off");
    fixture.detectChanges();

    expect(showing(host, opener)).toEqual({ panels: 0, announced: "false" });
  });
});
