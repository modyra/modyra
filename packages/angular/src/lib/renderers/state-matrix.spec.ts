/**
 * The state matrix, driven against the Angular renderers.
 *
 * Same judgement as Plain and Lit — `collectStateMatrix` from `@modyra/widgets/testing` — with only
 * the driving here. Until this existed a state defect in Angular was invisible: the matrix ran on
 * Plain alone, which is how `readonly` was fixed there, reported closed, and stayed broken here.
 */
import "@angular/compiler";
import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  collectStateMatrix,
  normalizeStateLedger,
  type MdyStateFixture,
} from "@modyra/widgets/testing";
import type { MdyWidgetKind } from "@modyra/widgets";

import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyCheckboxComponent } from "./checkbox/checkbox-renderer.component";
import { MdyNumberComponent } from "./number/number-renderer.component";
import { MdySliderComponent } from "./slider/slider-renderer.component";
import { MdyTextComponent } from "./text/text-renderer.component";
import { MdyTextareaComponent } from "./textarea/textarea-renderer.component";
import { MdyToggleComponent } from "./toggle/toggle-renderer.component";

/**
 * The kinds that declare `readonly` plus the boolean pair, which is where this batch's change
 * lands. The composite kinds already answer to `dom-contract.spec.ts` on all seventeen; widening
 * the *state* matrix to them is worth its own batch rather than being smuggled into this one.
 */
const KINDS: readonly MdyWidgetKind[] = [
  "text", "email", "password", "textarea", "number", "slider", "checkbox", "toggle",
];

@Component({
  standalone: true,
  imports: [
    MdyFormComponent, MdyTextComponent, MdyTextareaComponent, MdyNumberComponent,
    MdyCheckboxComponent, MdyToggleComponent, MdySliderComponent,
  ],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="text" label="Text" />
      <mdy-control-text name="mail" label="Mail" type="email" />
      <mdy-control-text name="secret" label="Secret" type="password" />
      <mdy-control-textarea name="notes" label="Notes" />
      <mdy-control-number name="age" label="Age" />
      <mdy-control-slider name="volume" label="Volume" />
      <mdy-control-checkbox name="terms" label="Terms" />
      <mdy-control-toggle name="news" label="News" />
    </mdy-form>
  `,
})
class MatrixHost {
  adapter = new MdyDeclarativeAdapter(signal({}), undefined, TestBed.inject(Injector));
}

/** Which control in the host answers for each kind, and the selector that finds its root. */
const FIELD_FOR: Readonly<Record<string, { name: string; selector: string }>> = {
  text: { name: "text", selector: "mdy-control-text[type=text], mdy-control-text:not([type])" },
  email: { name: "mail", selector: "mdy-control-text[type=email]" },
  password: { name: "secret", selector: "mdy-control-text[type=password]" },
  textarea: { name: "notes", selector: "mdy-control-textarea" },
  number: { name: "age", selector: "mdy-control-number" },
  slider: { name: "volume", selector: "mdy-control-slider" },
  checkbox: { name: "terms", selector: "mdy-control-checkbox" },
  toggle: { name: "news", selector: "mdy-control-toggle" },
};

function valueFor(kind: MdyWidgetKind): unknown {
  switch (kind) {
    case "number": case "slider": return 7;
    case "checkbox": case "toggle": return true;
    default: return "value";
  }
}

function emptyFor(kind: MdyWidgetKind): unknown {
  switch (kind) {
    case "checkbox": case "toggle": return false;
    case "number": case "slider": return null;
    default: return "";
  }
}

function controlOf(root: Element): Element | null {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select")
    ?? root.querySelector("input, textarea, select");
}

function partsOf(root: Element): Record<string, Element | null> {
  const q = (selector: string): Element | null => root.querySelector(selector);
  return {
    label: q(".mdy-label, .mdy-toggle__label"),
    requiredMarker: q(".mdy-label__required"),
    inputWrapper: q(".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle"),
    control: controlOf(root),
    supportingText: q(".mdy-supporting-text"),
    errors: q(".mdy-control__errors"),
    errorItem: q(".mdy-control__error"),
  };
}

/**
 * Angular's divergences from the state contract, recorded rather than waived. This ledger is new —
 * the matrix has never run against Angular — so its first contents are a measurement.
 */
const KNOWN_DIVERGENCES: Record<string, string[]> = {
  // `invalid` is unreachable here rather than broken: this host declares no validators, so a field
  // emptied and touched is still valid and there are no errors to render. Reaching it means giving
  // the host real validators, which is worth doing and is not this batch.
  "text × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "email × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "password × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "textarea × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "number × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "slider × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "checkbox × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],
  "toggle × invalid": ["STATE_ARIA_WRONG", "STATE_PART_MISSING"],

  // Real: the slider exposes no `aria-disabled`. Angular hand-writes each attribute per template,
  // so an attribute the projection supplies is present only where someone bound it.
  "slider × disabled": ["STATE_ARIA_MISSING"],
};

describe("Angular renderers, against the widget state contract", () => {
  it("every declared state of every kind is asserted, and the divergences are the recorded ones", async () => {
    const matrix = await collectStateMatrix({
      kinds: KINDS,
      mount(kind): MdyStateFixture {
        const fixture = TestBed.createComponent(MatrixHost);
        fixture.detectChanges();
        const entry = FIELD_FOR[kind];
        if (!entry) throw new Error(`no host control declared for ${kind}`);
        const { name, selector } = entry;
        const root = fixture.nativeElement.querySelector(selector) as Element;
        const adapter = fixture.componentInstance.adapter;
        const field = adapter.getField(name);

        return {
          root,
          parts: () => partsOf(root),
          control: () => controlOf(root),
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
              case "disabled": adapter.setDisabled(name, signal(true)); return true;
              case "readonly": adapter.setReadonly(name, signal(true)); return true;
              default: return false;
            }
          },
        };
      },
    });

    // eslint-disable-next-line no-console -- the matrix is the deliverable; a matrix nobody can read
    // the shape of will silently lose rows.
    console.log(matrix.report("angular, readonly-declaring kinds"));

    expect(matrix.asserted + matrix.undrivable.length).toBe(matrix.expected);
    expect(matrix.observed).toEqual(normalizeStateLedger(KNOWN_DIVERGENCES));
    expect(matrix.unsupportedAria).toEqual([]);
  });
});
