/**
 * The catalogue fixture: one host mounting all seventeen kinds, and one map saying where each
 * contract part lives in the Angular DOM.
 *
 * Shared by `dom-contract.spec.ts` (is the shape right) and `state-matrix.spec.ts` (does it behave
 * right in each state). Those two had separate hosts and separate part resolvers, and the state
 * matrix's was text-field-shaped — the same duplication that made Plain's matrix misjudge radio and
 * segmented earlier in this milestone, reporting renderer defects that were really the resolver
 * looking for a text input inside a radio group.
 *
 * **Named `.spec.ts` on purpose.** `tsconfig.lib.json` excludes `**\/*.spec.ts` from the published
 * build and `jest.config.cjs` matches `src/**\/*.spec.ts`; any other name would either ship this
 * fixture to consumers or need a new exclude glob in shared build configuration. The test below is
 * therefore load-bearing in two ways: Jest requires this file to contain one, and a kind that stops
 * mounting would otherwise silently narrow both dependent suites instead of failing.
 */
import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
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

/**
 * Every kind, the selector that finds it, and the field name it registers under.
 *
 * One list, so a kind cannot be mounted by the host and then forgotten by a suite.
 */
export const CATALOG_KINDS: ReadonlyArray<{
  readonly kind: MdyWidgetKind;
  readonly selector: string;
  readonly name: string;
}> = [
  { kind: "text", selector: "mdy-control-text[name=text]", name: "text" },
  { kind: "textarea", selector: "mdy-control-textarea", name: "notes" },
  { kind: "number", selector: "mdy-control-number", name: "age" },
  { kind: "checkbox", selector: "mdy-control-checkbox", name: "terms" },
  { kind: "toggle", selector: "mdy-control-toggle", name: "news" },
  { kind: "slider", selector: "mdy-control-slider", name: "volume" },
  { kind: "radio", selector: "mdy-control-radio", name: "plan" },
  { kind: "segmented", selector: "mdy-control-segmented", name: "billing" },
  { kind: "email", selector: "mdy-control-text[type=email]", name: "mail" },
  { kind: "password", selector: "mdy-control-text[type=password]", name: "secret" },
  { kind: "select", selector: "mdy-control-select", name: "country" },
  { kind: "multiselect", selector: "mdy-control-multiselect", name: "tags" },
  { kind: "datepicker", selector: "mdy-control-datepicker", name: "birthday" },
  { kind: "daterange", selector: "mdy-control-daterange", name: "trip" },
  { kind: "timepicker", selector: "mdy-control-timepicker", name: "slot" },
  { kind: "file", selector: "mdy-control-file", name: "cv" },
  { kind: "colors", selector: "mdy-control-colors", name: "brand" },
];

/**
 * Every control is `mdyRequired`, and select and multiselect are `searchable`.
 *
 * Without a validator no field can be invalid, so every `invalid` row measures nothing. Without
 * `searchable` the select renders a native `<select>` and has no trigger to click, so its overlay
 * transitions cannot be driven at all. The required marker and `aria-required` that come with the
 * validator are part of the contract these suites check, not noise.
 */
@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyTextareaComponent, MdyNumberComponent,
    MdyCheckboxComponent, MdyToggleComponent, MdySliderComponent,
    MdyRadioGroupComponent, MdySegmentedButtonComponent,
    MdySelectComponent, MdyMultiselectComponent, MdyDatePickerComponent,
    MdyDateRangePickerComponent, MdyTimepickerComponent, MdyFileComponent, MdyColorsComponent,
    MdyRequiredDirective,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="text" label="Text" mdyRequired />
      <mdy-control-textarea name="notes" label="Notes" mdyRequired />
      <mdy-control-number name="age" label="Age" mdyRequired />
      <mdy-control-checkbox name="terms" label="Terms" mdyRequired />
      <mdy-control-toggle name="news" label="News" mdyRequired />
      <mdy-control-slider name="volume" label="Volume" mdyRequired />
      <mdy-control-radio name="plan" label="Plan" [options]="options" mdyRequired />
      <mdy-control-segmented name="billing" label="Billing" [options]="options" mdyRequired />
      <mdy-control-text name="mail" label="Mail" type="email" mdyRequired />
      <mdy-control-text name="secret" label="Secret" type="password" mdyRequired />
      <mdy-control-select name="country" label="Country" [options]="options" searchable mdyRequired />
      <mdy-control-multiselect name="tags" label="Tags" [options]="options" searchable mdyRequired />
      <mdy-control-datepicker name="birthday" label="Birthday" mdyRequired />
      <mdy-control-daterange name="trip" label="Trip" mdyRequired />
      <mdy-control-timepicker name="slot" label="Slot" mdyRequired />
      <mdy-control-file name="cv" label="CV" mdyRequired />
      <mdy-control-colors name="brand" label="Brand" mdyRequired />
    </mdy-form>
  `,
})
export class CatalogHost {
  adapter = new MdyDeclarativeAdapter(signal({}), undefined, TestBed.inject(Injector));
  options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
}

/**
 * A popup may be projected into a CDK panel outside the field, so it is found through the
 * relationship the widget declared — the id its own opener names — and only then by class inside
 * the root. Searching the document by class alone would find another field's popup.
 */
export function popupOf(root: Element, className: string): Element | null {
  const opener = root.querySelector("[aria-controls]");
  const named = opener && root.ownerDocument?.getElementById(opener.getAttribute("aria-controls")!);
  if (named) return named.closest(className) ?? named;
  return root.querySelector(className);
}

/** Where each contract part lives in the Angular DOM, per kind. */
export function partsOf(
  root: Element,
  kind: MdyWidgetKind,
): Record<string, Element | readonly Element[] | null> {
  const q = (selector: string) => root.querySelector(selector);
  // A part the contract marks `repeated` has to be mapped with every element it rendered. Mapping
  // one of many makes each of its children look mis-parented, since the child belongs to a sibling
  // the map never mentioned.
  const qa = (selector: string) => Array.from(root.querySelectorAll(selector));
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
      return { ...shell, inputWrapper: q(".mdy-input-wrapper"), loading: q(".mdy-select__loader"), trigger: q(".mdy-select__trigger"), value: q(".mdy-select__value"), placeholder: q(".mdy-select__placeholder"), arrow: q(".mdy-select__arrow"), popup: popupOf(root, ".mdy-select__dropdown"), listbox: popupOf(root, ".mdy-select__dropdown")?.querySelector(".mdy-select__list") ?? null, option: Array.from(popupOf(root, ".mdy-select__dropdown")?.querySelectorAll(".mdy-select__option") ?? []) };
    case "multiselect":
      return { ...shell, inputWrapper: q(".mdy-multiselect"), loading: q(".mdy-select__loader"), header: q(".mdy-multiselect__header"), searchButton: q(".mdy-multiselect__search-btn"), options: q(".mdy-multiselect__options"), optionWrapper: qa(".mdy-chip-wrapper"), option: qa(".mdy-chip"), optionLabel: qa(".mdy-chip__label"), popup: popupOf(root, ".mdy-multiselect__dropdown") };
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

describe("the catalogue fixture", () => {
  it("mounts every kind the contract declares", () => {
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();

    const missing = CATALOG_KINDS
      .filter(({ selector }) => !fixture.nativeElement.querySelector(selector))
      .map(({ kind }) => kind);

    // A kind that stops mounting would otherwise narrow both dependent suites in silence: they
    // would assert less and still report green.
    expect(missing).toEqual([]);
    expect(CATALOG_KINDS).toHaveLength(17);
  });
});
