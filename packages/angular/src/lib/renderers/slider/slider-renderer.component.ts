import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, viewChild } from "@angular/core";
import type { MdyFieldConstraints } from "@modyra/core";
import { MDY_CSS_PROPERTIES, MDY_WIDGET_CONTRACTS, sliderFillRatio } from "@modyra/widgets";
import { MdyPartDirective } from "../../control/mdy-part.directive";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyErrorListComponent } from "../../control/error-list.component";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { inputText } from "../renderer-projection";

@Component({
  selector: "mdy-control-slider",
  standalone: true,
  imports: [MdyPartDirective, NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--slider",
    "[class.mdy-renderer]": "widgetHasRootClass",
    "[class.mdy-inline-errors]": "inlineErrors",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [words]="controlAriaLabel() ?? ''"
      [forId]="fieldId"
      [hasError]="paintsAsInvalid()"
      [required]="isRequired()"
      [filled]="true"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
      [errorsId]="inlineErrorShown() ? errorsElementId(fieldId) : ''"
    />

    <div class="{{ cls.track }}">
      <input
        #rangeInput
        type="range"
        class="{{ cls.control }}"
        [id]="fieldId"
        [attr.aria-label]="controlAriaLabel()"
        [value]="value() ?? effectiveMin()"
        [disabled]="isDisabled()"
        (input)="onInput($event)"
        (change)="onChange($event)"
        (blur)="dispatchValueBlur('slider')"
        [mdyPart]="controlPart()"
      />
      @if (showValue()) {
        <span class="{{ cls.value }}">{{ value() }}</span>
      }
    </div>

    @if (projectedSupportingText(); as st) {
      <div class="{{ cls.supportingText }}" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="{{ cls.supportingText }}" [id]="descriptionId(fieldId)">{{ text }}</div>
    } @else {
      <!-- Drawn with nothing in it, and out of sight. The projection names this id
           whenever it describes the control, so an element that appears only once
           there are words leaves that reference pointing at nothing — the defect one
           step worse than an empty description. The two halves stay apart: the
           element is always here for a reference to land on, and describedById
           decides whether making the reference is worth a reader's move. -->
      <div class="{{ cls.supportingText }}" [id]="descriptionId(fieldId)" hidden></div>
    }
    @if (errorsReserved()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errorsOnScreen()" />
    }
  `,
})
export class MdySliderComponent extends MdyBaseControl<number> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.slider;

  /**
   * The class every part and box wears, asked of the catalogue once. Spelled in the template it
   * is a second copy of a name the catalogue holds, and a copy is where the two can disagree.
   */
  // Class names the catalogue owns, resolved once. The type is deliberately the wide record
  // rather than the inferred shape: a component's declared surface must not change every time
  // its kind gains a part, and a key that is not a part of this kind is refused by the gate
  // that reads this file against the catalogue.
  protected readonly cls: Readonly<Record<string, string>> = {
    control: this.widgetContract.parts.control.classes.join(" "),
    supportingText: this.widgetContract.parts.supportingText.classes.join(" "),
    track: this.widgetContract.parts.track.classes.join(" "),
    value: this.widgetContract.parts.value.classes.join(" "),
  } as const;
  protected override readonly widgetKind = "slider" as const;
  protected readonly widgetHasRootClass = this.widgetContract.rootClasses.includes("mdy-renderer");
  /**
   * The ends of the track. Left unset they are the field's own rules, and where those say nothing
   * either, what a bare `<input type="range">` assumes — a slider has to span something to be drawn.
   */
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);

  protected readonly effectiveMin = computed(
    () => this.min() ?? this.fieldState().constraints().min ?? 0,
  );
  protected readonly effectiveMax = computed(
    () => this.max() ?? this.fieldState().constraints().max ?? 100,
  );
  readonly step = input<number>(1);

  /**
   * What this control offers of the track, which can only ever be less than the rules allow.
   *
   * Stated once, here, rather than as `min`/`max`/`step` on the input: the projection places those
   * attributes, and a template writing them too means two answers whose order decides which one the
   * user gets.
   */
  protected override narrowedConstraints(): Partial<MdyFieldConstraints> {
    const low = this.min();
    const high = this.max();
    return {
      ...(low === null ? {} : { min: low }),
      ...(high === null ? {} : { max: high }),
      step: this.step(),
    };
  }
  readonly showValue = input<boolean>(true);

  private readonly rangeInput = viewChild<ElementRef<HTMLInputElement>>('rangeInput');


  constructor() {
    super();
    effect(() => {
      const el = this.rangeInput()?.nativeElement;
      const min = this.effectiveMin();
      const max = this.effectiveMax();
      const value = this.value() ?? min;
      if (!el) return;
      el.style.setProperty(
        MDY_CSS_PROPERTIES.control.sliderFill,
        String(sliderFillRatio(value, min, max)),
      );
    });
  }

  protected onInput(event: Event): void {
    this.dispatchValueIntent<number>("slider", { type: "input", value: Number(inputText(event)) });
  }

  protected onChange(_event: Event): void {
    this.dispatchValueBlur("slider");
  }
}
