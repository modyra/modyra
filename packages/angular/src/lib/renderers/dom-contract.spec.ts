/**
 * Runtime DOM conformance for the Angular renderers.
 *
 * The static audits prove the renderers *reference* the contract; this mounts them and checks what
 * they actually rendered with the same `assertWidgetDomContract` the Lit and Plain suites use, so
 * all three adapters answer to one gate rather than three descriptions of one.
 */
import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { inspectWidgetDom } from "@modyra/widgets/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyNumberComponent } from "./number/number-renderer.component";
import { MdyRadioGroupComponent } from "./radio/radio-group-renderer.component";
import { MdySegmentedButtonComponent } from "./segmented-button/segmented-button-renderer.component";
import { MdySliderComponent } from "./slider/slider-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";
import { MdyTextareaComponent } from "./textarea/textarea-renderer.component";
import { MdyToggleComponent } from "./toggle/toggle-renderer.component";

@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyTextareaComponent, MdyNumberComponent,
    MdyCheckboxComponent, MdyToggleComponent, MdySliderComponent,
    MdyRadioGroupComponent, MdySegmentedButtonComponent,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="text" label="Text" />
      <mdy-control-textarea name="notes" label="Notes" />
      <mdy-control-number name="age" label="Age" />
      <mdy-control-checkbox name="terms" label="Terms" />
      <mdy-control-toggle name="news" label="News" />
      <mdy-control-slider name="volume" label="Volume" />
      <mdy-control-radio name="plan" label="Plan" [options]="options" />
      <mdy-control-segmented name="billing" label="Billing" [options]="options" />
    </mdy-form>
  `,
})
class CatalogHost {
  adapter = new MdyDeclarativeAdapter(signal({}), undefined, TestBed.inject(Injector));
  options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
}

/** Where each contract part lives in the Angular DOM, per kind. */
function partsOf(root: Element, kind: MdyWidgetKind): Record<string, Element | null> {
  const q = (selector: string) => root.querySelector(selector);
  const shell = {
    label: q(".mdy-label, .mdy-toggle__label"),
    requiredMarker: q(".mdy-label__required"),
    inputWrapper: q(".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle"),
    supportingText: q(".mdy-supporting-text"),
    errors: q(".mdy-control__errors"),
    errorItem: q(".mdy-control__error"),
  };
  switch (kind) {
    case "checkbox":
      return { ...shell, control: q(".mdy-checkbox__control") };
    case "toggle":
      return { ...shell, control: q(".mdy-toggle__control"), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb") };
    case "slider":
      return { ...shell, track: q(".mdy-slider-container"), control: q(".mdy-slider"), value: q(".mdy-slider-value") };
    case "radio":
      return { ...shell, group: q(".mdy-radio-group"), option: q(".mdy-radio-item"), optionControl: q(".mdy-radio-circle"), optionLabel: q(".mdy-radio-label") };
    case "segmented":
      return { ...shell, group: q(".mdy-segmented"), option: q(".mdy-segmented__button"), optionCheck: q(".mdy-segmented__check"), optionText: q(".mdy-segmented__text") };
    default:
      return { ...shell, control: q("input, textarea") };
  }
}

/**
 * Angular's remaining divergences from the contract, recorded rather than waived. The expectation
 * below matches this map exactly, so a new one fails the suite and a fixed one cannot linger.
 */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {};

describe("Angular renderers, against the widget DOM contract", () => {
  const KINDS: ReadonlyArray<readonly [string, MdyWidgetKind]> = [
    ["mdy-control-text", "text"],
    ["mdy-control-textarea", "textarea"],
    ["mdy-control-number", "number"],
    ["mdy-control-checkbox", "checkbox"],
    ["mdy-control-toggle", "toggle"],
    ["mdy-control-slider", "slider"],
    ["mdy-control-radio", "radio"],
    ["mdy-control-segmented", "segmented"],
  ];

  it.each(KINDS.map(([selector, kind]) => [kind, selector]))(
    "%s conforms",
    (kind, selector) => {
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(selector as string) as Element;
      expect(root).toBeTruthy();

      const issues = inspectWidgetDom(root, kind as MdyWidgetKind, {
        parts: partsOf(root, kind as MdyWidgetKind),
      });
      expect(issues.map((issue) => `${issue.code}:${issue.part}`))
        .toEqual(KNOWN_DIVERGENCES[kind as MdyWidgetKind] ?? []);
    },
  );
});
