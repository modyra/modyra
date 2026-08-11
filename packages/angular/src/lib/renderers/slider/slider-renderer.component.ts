import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, viewChild } from "@angular/core";
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
      [showInlineError]="inlineErrors && touched() && hasErrors()"
      [errorText]="inlineErrorText()"
    />

    <div class="mdy-slider-container">
      <input
        #rangeInput
        type="range"
        class="mdy-slider"
        [id]="fieldId"
        [min]="effectiveMin()"
        [max]="effectiveMax()"
        [step]="step()"
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

    @if (supportingText(); as st) {
      <div class="mdy-supporting-text" [id]="descriptionId(fieldId)">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdySliderComponent extends MdyBaseControl<number> {
  protected readonly widgetContract = MDY_WIDGET_CONTRACTS.slider;
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
  readonly showValue = input<boolean>(true);

  private readonly rangeInput = viewChild<ElementRef<HTMLInputElement>>('rangeInput');

  protected readonly fieldId = `mdy-control-slider-${MdyBaseControl.nextId()}`;

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
