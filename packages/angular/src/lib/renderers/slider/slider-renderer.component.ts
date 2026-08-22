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
    "[class.mdy-renderer--touched]": "touched()",
  },
  template: `
    <mdy-control-label
      [label]="label()"
      [forId]="fieldId"
      [required]="isRequired()"
      [filled]="true"
      [showInlineError]="inlineErrorShown()"
      [errorText]="inlineErrorText()"
    />

    <div class="mdy-slider-container">
      <input
        #rangeInput
        type="range"
        class="mdy-slider"
        [id]="fieldId"
        [value]="value() ?? effectiveMin()"
        [disabled]="isDisabled()"
        (input)="onInput($event)"
        (change)="onChange($event)"
        (blur)="dispatchValueBlur('slider')"
        [mdyPart]="controlPart()"
      />
      @if (showValue()) {
        <span class="mdy-slider-value">{{ value() }}</span>
      }
    </div>

    @if (projectedSupportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    } @else if (supportingText(); as text) {
      <!-- The value route, for a field that declared its own words rather than
           projecting them. A document has no template to project. -->
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">{{ text }}</div>
    }
    @if (errorsRendered()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdySliderComponent extends MdyBaseControl<number> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.slider;
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
