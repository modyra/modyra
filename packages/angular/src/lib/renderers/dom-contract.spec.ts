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
import { MdyColorsComponent } from "./colors/colors-renderer.component";
import { MdyDatePickerComponent } from "./datepicker/datepicker.component";
import { MdyDateRangePickerComponent } from "./datepicker/daterange-renderer.component";
import { MdyFileComponent } from "./file/file-renderer.component";
import { MdyMultiselectComponent } from "./multiselect/multiselect-renderer.component";
import { MdySelectComponent } from "./select/select-renderer.component";
import { MdyTimepickerComponent } from "./timepicker/timepicker-renderer.component";

@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyTextareaComponent, MdyNumberComponent,
    MdyCheckboxComponent, MdyToggleComponent, MdySliderComponent,
    MdyRadioGroupComponent, MdySegmentedButtonComponent,
    MdySelectComponent, MdyMultiselectComponent, MdyDatePickerComponent,
    MdyDateRangePickerComponent, MdyTimepickerComponent, MdyFileComponent, MdyColorsComponent,
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
      <mdy-control-text name="mail" label="Mail" type="email" />
      <mdy-control-text name="secret" label="Secret" type="password" />
      <mdy-control-select name="country" label="Country" [options]="options" />
      <mdy-control-multiselect name="tags" label="Tags" [options]="options" />
      <mdy-control-datepicker name="birthday" label="Birthday" />
      <mdy-control-daterange name="trip" label="Trip" />
      <mdy-control-timepicker name="slot" label="Slot" />
      <mdy-control-file name="cv" label="CV" />
      <mdy-control-colors name="brand" label="Brand" />
    </mdy-form>
  `,
})
class CatalogHost {
  adapter = new MdyDeclarativeAdapter(signal({}), undefined, TestBed.inject(Injector));
  options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
}

/**
 * A popup may be projected into a CDK panel outside the field, so it is found through the
 * relationship the widget declared — the id its own opener names — and only then by class inside
 * the root. Searching the document by class alone would find another field's popup.
 */
function popupOf(root: Element, className: string): Element | null {
  const opener = root.querySelector("[aria-controls]");
  const named = opener && root.ownerDocument?.getElementById(opener.getAttribute("aria-controls")!);
  if (named) return named.closest(className) ?? named;
  return root.querySelector(className);
}

/** Where each contract part lives in the Angular DOM, per kind. */
function partsOf(root: Element, kind: MdyWidgetKind): Record<string, Element | readonly Element[] | null> {
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
      return { ...shell, control: q(".mdy-checkbox__control"), indicator: q(".mdy-checkbox__indicator") };
    case "toggle":
      return { ...shell, control: q(".mdy-toggle__control"), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb") };
    case "slider":
      return { ...shell, track: q(".mdy-slider-container"), control: q(".mdy-slider"), value: q(".mdy-slider-value") };
    case "radio":
      return { ...shell, group: q(".mdy-radio-group"), option: q(".mdy-radio-item"), optionControl: q(".mdy-radio-circle"), optionLabel: q(".mdy-radio-label") };
    case "segmented":
      return { ...shell, group: q(".mdy-segmented"), option: q(".mdy-segmented__button"), optionCheck: q(".mdy-segmented__check"), optionText: q(".mdy-segmented__text") };
    case "select":
      return { ...shell, inputWrapper: q(".mdy-input-wrapper"), trigger: q(".mdy-select__trigger"), value: q(".mdy-select__value"), placeholder: q(".mdy-select__placeholder"), arrow: q(".mdy-select__arrow"), popup: popupOf(root, ".mdy-select__dropdown"), listbox: popupOf(root, ".mdy-select__dropdown")?.querySelector(".mdy-select__list") ?? null, option: Array.from(popupOf(root, ".mdy-select__dropdown")?.querySelectorAll(".mdy-select__option") ?? []) };
    case "multiselect":
      return { ...shell, inputWrapper: q(".mdy-multiselect"), header: q(".mdy-multiselect__header"), searchButton: q(".mdy-multiselect__search-btn"), options: q(".mdy-multiselect__options"), optionWrapper: q(".mdy-chip-wrapper"), option: q(".mdy-chip"), optionLabel: q(".mdy-chip__label"), popup: popupOf(root, ".mdy-multiselect__dropdown") };
    case "datepicker":
      return { ...shell, control: q(".mdy-datepicker__input"), toggle: q(".mdy-datepicker__toggle"), popup: popupOf(root, ".mdy-datepicker__popup"), grid: popupOf(root, ".mdy-datepicker__popup")?.querySelector(".mdy-datepicker__grid") ?? null };
    case "daterange": {
      const inputs = root.querySelectorAll(".mdy-daterange__input");
      return { ...shell, startControl: inputs[0] ?? null, endControl: inputs[1] ?? null, separator: q(".mdy-daterange__sep"), toggle: q(".mdy-datepicker__toggle"), popup: popupOf(root, ".mdy-datepicker__popup") };
    }
    case "timepicker":
      return { ...shell, control: q(".mdy-timepicker__input"), toggle: q(".mdy-timepicker__toggle"), popup: popupOf(root, ".mdy-timepicker__popup") };
    case "file":
      return { ...shell, inputWrapper: null, dropzone: q(".mdy-file-container"), control: q(".mdy-file-input"), content: q(".mdy-file-content"), fileList: q(".mdy-file-list"), clear: q(".mdy-file-clear") };
    case "colors":
      return { ...shell, nativePicker: q(".mdy-colors__primary-picker"), preview: q(".mdy-colors__preview-swatch"), control: q(".mdy-colors__native-hidden"), hexInput: q(".mdy-colors__hex-input"), toggle: q(".mdy-colors__toggle-area"), popup: popupOf(root, ".mdy-colors__dropdown") };
    default:
      return { ...shell, control: q("input, textarea") };
  }
}

/**
 * Angular's remaining divergences from the contract, recorded rather than waived. The expectation
 * below matches this map exactly, so a new one fails the suite and a fixed one cannot linger.
 */
const KNOWN_DIVERGENCES: Partial<Record<MdyWidgetKind, string[]>> = {
  // Angular's select renders a native <select> unless an option template or search is supplied —
  // the custom trigger sits behind `@if (optionTpl() || searchable())`. The contract makes `trigger`
  // required, so in its native mode Angular has no element to offer. Either the contract must let a
  // native <select> satisfy `trigger`, or the renderer must always emit one. That is a
  // renderer-equivalence decision, not a fixture bug: Plain always renders a trigger.
  select: ["PART_MISSING:trigger"],
  // The chips wrapper precedes the input wrapper in Angular and follows it in Plain, and the label
  // points at an id no element in this fixture carries.
  multiselect: ["PART_ORDER:inputWrapper", "ARIA_DANGLING_REF:label"],
  // `nativePicker` was declared a <label> in task 06, from Plain, which wraps the hidden colour
  // input in one. Angular does not, and its `control` sits outside the picker as a result.
  colors: ["PART_ELEMENT:nativePicker", "PART_NOT_CONTAINED:control", "PART_NOT_OWNED:toggle"],
  // F-08 is closed centrally — the a11y projections now declare `aria-controls`, and Plain is clean.
  // Angular remains divergent for a different reason, and it is a *placement* question rather than a
  // missing relation: Angular puts `aria-expanded` on the toggle button beside the input, while the
  // shared projection puts the whole combobox relation on the input itself. Making them agree means
  // deciding which element owns the expanded state and giving the CDK panel an id the opener can
  // name — a renderer-equivalence decision, so it belongs to task 16 rather than to a defect batch.
  datepicker: ["PART_NOT_OWNED:control"],
  timepicker: ["PART_NOT_OWNED:control"],
  // Same placement question; Angular's daterange toggle carries the state and names no popup.
  daterange: ["PART_NOT_OWNED:toggle"],
};

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
    ["mdy-control-text[type=email]", "email"],
    ["mdy-control-text[type=password]", "password"],
    ["mdy-control-select", "select"],
    ["mdy-control-multiselect", "multiselect"],
    ["mdy-control-datepicker", "datepicker"],
    ["mdy-control-daterange", "daterange"],
    ["mdy-control-timepicker", "timepicker"],
    ["mdy-control-file", "file"],
    ["mdy-control-colors", "colors"],
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
