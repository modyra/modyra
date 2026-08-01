/**
 * The catalogue fixture: one host mounting all seventeen kinds, and one map saying where each
 * contract part lives in the Angular DOM.
 *
 * Shared by `dom-contract.spec.ts` (is the shape right), `state-matrix.spec.ts` (does it behave
 * right in each state) and `equivalence.spec.ts` (do the three renderers agree). Those suites had
 * separate hosts and separate part resolvers, and the state matrix's was text-field-shaped — the
 * same duplication that made Plain's matrix misjudge radio and segmented earlier in this milestone,
 * reporting renderer defects that were really the resolver looking for a text input inside a radio
 * group.
 *
 * `mountStateFixture` is the driving half, here for the same reason: the suite that asks whether a
 * state looks right and the suite that asks whether three renderers agree about it must be looking
 * at the same widget.
 *
 * **Named `.spec.ts` on purpose.** `tsconfig.lib.json` excludes `**\/*.spec.ts` from the published
 * build and `jest.config.cjs` matches `src/**\/*.spec.ts`; any other name would either ship this
 * fixture to consumers or need a new exclude glob in shared build configuration. The test below is
 * therefore load-bearing in two ways: Jest requires this file to contain one, and a kind that stops
 * mounting would otherwise silently narrow both dependent suites instead of failing.
 */
import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type { MdyWidgetKind } from "@modyra/widgets";
import type { MdyStateFixture } from "@modyra/widgets/testing";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyPrefixDirective } from "../control/prefix.directive";
import { MdySuffixDirective } from "../control/suffix.directive";
import { MdyMinDirective } from "../validators/directives/mdy-min.directive";
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
    MdyRequiredDirective, MdyMinDirective, MdyPrefixDirective, MdySuffixDirective,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="text" label="Text" mdyRequired>
        <ng-template mdyPrefix>@</ng-template>
        <ng-template mdySuffix>.com</ng-template>
      </mdy-control-text>
      <mdy-control-textarea name="notes" label="Notes" mdyRequired />
      <mdy-control-number name="age" label="Age" mdyRequired />
      <mdy-control-checkbox name="terms" label="Terms" mdyRequired />
      <mdy-control-toggle name="news" label="News" mdyRequired />
      <!-- A slider is never empty, so mdyRequired alone can never fail on one and its invalid row
           would be green because the state is unreachable rather than because the renderer is right. -->
      <mdy-control-slider name="volume" label="Volume" mdyRequired [mdyMin]="1" />
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

const ENTRY = new Map(CATALOG_KINDS.map((entry) => [entry.kind, entry]));

/** A value each kind will actually accept — a filled state reached with a rejected value is empty. */
export function valueFor(kind: MdyWidgetKind): unknown {
  switch (kind) {
    case "number": case "slider": return 7;
    case "checkbox": case "toggle": return true;
    case "multiselect": return ["a"];
    case "radio": case "segmented": case "select": return "a";
    case "datepicker": return "2026-07-15";
    case "daterange": return { start: "2026-07-15", end: "2026-07-20" };
    case "timepicker": return "10:30";
    case "colors": return "#004cff";
    case "file": return [new File(["content"], "report.txt", { type: "text/plain" })];
    default: return "value";
  }
}

/**
 * The empty value each kind can hold.
 *
 * Not `""` for everything: a daterange handed a string where an object belongs is rejected by
 * `required` for being an empty string rather than for being an empty range, so its `invalid` row
 * goes green because of the fixture.
 */
export function emptyFor(kind: MdyWidgetKind): unknown {
  switch (kind) {
    case "multiselect": return [];
    case "checkbox": case "toggle": return false;
    case "number": return null;
    // A slider is never empty: its thumb is somewhere, and that somewhere is its minimum.
    case "slider": return 0;
    case "file": return [];
    case "daterange": return { start: null, end: null };
    default: return "";
  }
}

export function controlOf(root: Element): Element | null {
  return root.querySelector(
    ".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select",
  ) ?? root.querySelector("input, textarea, select");
}

/** The element that opens each composite's overlay, by the part the catalogue names. */
export const OPENER = ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
  + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn";

/** Mount one widget of `kind` on the catalogue host, ready to drive into any declared state. */
export function mountStateFixture(kind: MdyWidgetKind): MdyStateFixture {
  const fixture = TestBed.createComponent(CatalogHost);
  fixture.detectChanges();
  const entry = ENTRY.get(kind);
  if (!entry) throw new Error(`no host control declared for ${kind}`);
  const root = fixture.nativeElement.querySelector(entry.selector) as Element;
  const adapter = fixture.componentInstance.adapter;
  const field = adapter.getField(entry.name);

  return {
    root,
    parts: () => partsOf(root, kind),
    control: () => controlOf(root),
    value: () => field?.().value(),
    // A panel projected into a CDK overlay is still this widget's. A snapshot that could not reach
    // it would call every lifted overlay absent.
    portalRoots: () => Array.from(root.ownerDocument.body.children).filter(
      (element) => !root.contains(element) && element.querySelector?.("[class*='__dropdown']"),
    ),
    // Angular renders on change detection, not on a task.
    settle: () => { fixture.detectChanges(); },
    dispose: () => fixture.destroy(),
    drive(state): boolean {
      switch (state) {
        case "pristine": return true;
        case "empty": field?.().value.set(emptyFor(kind)); return true;
        case "filled": field?.().value.set(valueFor(kind)); return true;
        case "touched": field?.().touched.set(true); return true;
        case "invalid":
          field?.().value.set(emptyFor(kind));
          field?.().touched.set(true);
          return true;
        case "focused": (controlOf(root) as HTMLElement | null)?.focus?.(); return true;
        case "selected": field?.().value.set(valueFor(kind)); return true;
        case "disabled": adapter.setDisabled(entry.name, signal(true)); return true;
        case "readonly": adapter.setReadonly(entry.name, signal(true)); return true;
        case "open": {
          const opener = root.querySelector(OPENER) as HTMLElement | null;
          if (!opener) return false;
          opener.click();
          fixture.detectChanges();
          return true;
        }
        case "loading": {
          // Async options are the renderer's concern, not the form's, so the state is driven
          // through the control that owns it.
          const control = fixture.debugElement.query(By.css(entry.selector))
            ?.componentInstance as { loadingOverride?: { set(v: boolean): void } } | undefined;
          if (!control?.loadingOverride) return false;
          control.loadingOverride.set(true);
          fixture.detectChanges();
          return true;
        }
        default: return false;
      }
    },
  };
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
