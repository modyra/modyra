/**
 * The inline-error affordance, which the main catalogue host cannot show.
 *
 * A field renders either the error list or the inline icon — `MdyInlineErrorsDirective` switches
 * between them — so the `inlineError` part is unreachable from a host that leaves the list on. It
 * went unchecked on thirteen kinds for exactly that reason, and the class the contract named for it
 * was one no renderer had ever emitted.
 *
 * This host is the other half of the pair: same kinds, same part resolver, inline errors on.
 */
import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "@modyra/widgets";
import { inspectWidgetDom } from "@modyra/widgets/testing";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyInlineErrorsDirective } from "../control/inline-errors.directive";
import { MdyRequiredDirective } from "../validators/directives/mdy-required.directive";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyNumberComponent } from "./number/number-renderer.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "./segmented-button/segmented-button-renderer.component";
import { MdySliderComponent } from "./slider/slider-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";
import { MdyTextareaComponent } from "./textarea/textarea-renderer.component";
import { MdyToggleComponent } from "./toggle/toggle-renderer.component";
import { MdyColorsComponent } from "./colors/colors-renderer.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { MdyDateRangePickerComponent } from "./datepicker/daterange-renderer.component";
import { MdyFileComponent } from "./file/file-renderer.component";
import { MdyMultiselectComponent } from "./multiselect/multiselect-renderer.component";
import { MdySelectComponent } from "./select/select-renderer.component";
import { MdyTimepickerComponent } from "./timepicker/timepicker-renderer.component";
import { CATALOG_KINDS, partsOf } from "./catalog-host.spec";

@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyTextareaComponent, MdyNumberComponent,
    MdyCheckboxComponent, MdyToggleComponent, MdySliderComponent,
    MdyRadioGroupComponent, MdySegmentedButtonComponent,
    MdySelectComponent, MdyMultiselectComponent, MdyDatePickerComponent,
    MdyDateRangePickerComponent, MdyTimepickerComponent, MdyFileComponent, MdyColorsComponent,
    MdyRequiredDirective, MdyInlineErrorsDirective,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="text" label="Text" mdyRequired mdyInlineErrors />
      <mdy-control-textarea name="notes" label="Notes" mdyRequired mdyInlineErrors />
      <mdy-control-number name="age" label="Age" mdyRequired mdyInlineErrors />
      <mdy-control-checkbox name="terms" label="Terms" mdyRequired mdyInlineErrors />
      <mdy-control-toggle name="news" label="News" mdyRequired mdyInlineErrors />
      <mdy-control-slider name="volume" label="Volume" mdyRequired mdyInlineErrors />
      <mdy-control-radio name="plan" label="Plan" [options]="options" mdyRequired mdyInlineErrors />
      <mdy-control-segmented name="billing" label="Billing" [options]="options" mdyRequired mdyInlineErrors />
      <mdy-control-text name="mail" label="Mail" type="email" mdyRequired mdyInlineErrors />
      <mdy-control-text name="secret" label="Secret" type="password" mdyRequired mdyInlineErrors />
      <mdy-control-select name="country" label="Country" [options]="options" searchable mdyRequired mdyInlineErrors />
      <mdy-control-multiselect name="tags" label="Tags" [options]="options" searchable mdyRequired mdyInlineErrors />
      <mdy-control-datepicker name="birthday" label="Birthday" mdyRequired mdyInlineErrors />
      <mdy-control-daterange name="trip" label="Trip" mdyRequired mdyInlineErrors />
      <mdy-control-timepicker name="slot" label="Slot" mdyRequired mdyInlineErrors />
      <mdy-control-file name="cv" label="CV" mdyRequired mdyInlineErrors />
      <mdy-control-colors name="brand" label="Brand" mdyRequired mdyInlineErrors />
    </mdy-form>
  `,
})
class InlineErrorsHost {
  adapter = new MdyDeclarativeAdapter(signal({}), undefined, TestBed.inject(Injector));
  options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
}

/** The kinds whose anatomy includes the part. Everything else has nothing to show here. */
const KINDS_WITH_INLINE_ERROR = CATALOG_KINDS.filter(({ kind }) =>
  MDY_WIDGET_CONTRACTS[kind].structure.nodes.some((node) => node.part === "inlineError"),
);

describe("Angular renderers, with inline errors on", () => {
  /**
   * This host repeats the catalogue's template because a directive cannot be applied conditionally.
   * The count is what keeps the copy honest: a kind added to `CATALOG_KINDS` and not to the template
   * above fails here instead of quietly going unchecked.
   */
  it("mounts every kind the catalogue declares", () => {
    const fixture = TestBed.createComponent(InlineErrorsHost);
    fixture.detectChanges();
    for (const { kind, selector } of CATALOG_KINDS) {
      expect(`${kind}: ${!!fixture.nativeElement.querySelector(selector)}`).toBe(`${kind}: true`);
    }
  });

  it.each(KINDS_WITH_INLINE_ERROR.map(({ kind, selector, name }) => [kind, selector, name]))(
    "%s renders the inline error and still conforms",
    (kind, selector, name) => {
      const fixture = TestBed.createComponent(InlineErrorsHost);
      fixture.detectChanges();
      // Required and empty makes it invalid; touched is what a field waits for before saying so.
      fixture.componentInstance.adapter.getField(name as string)?.().touched.set(true);
      fixture.detectChanges();

      const root = fixture.nativeElement.querySelector(selector as string) as Element;
      const inline = root.querySelector(".mdy-control__inline-errors");
      expect(`${kind}: ${!!inline}`).toBe(`${kind}: true`);

      const issues = inspectWidgetDom(root, kind as MdyWidgetKind, {
        parts: partsOf(root, kind as MdyWidgetKind),
        strictClasses: true,
      });
      expect(issues.map((issue) => `${issue.code}:${issue.part}: ${issue.message}`)).toEqual([]);
    },
  );
});
