import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, ElementRef, viewChild, input } from "@angular/core";
import { MdyBaseControl } from "../../control/control.directive";
import { MdyControlLabelComponent } from "../../control/mdy-control-label.component";
import { MdyErrorListComponent } from "../../control/error-list.component";

/**
 * Slider renderer component.
 */
@Component({
  selector: "mdy-control-slider",
  standalone: true,
  imports: [NgTemplateOutlet, MdyControlLabelComponent, MdyErrorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-renderer mdy-renderer--slider",
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
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value() ?? min()"
        [disabled]="isDisabled()"
        (input)="onInput($event)"
        (change)="onChange($event)"
        (blur)="markAsTouched()"
        [attr.aria-invalid]="hasErrors()"
        [attr.aria-describedby]="hasErrors() ? fieldId + '-errors' : null"
        [attr.aria-required]="ariaRequired() || isRequired()"
      />
      @if (showValue()) {
        <span class="mdy-slider-value">{{ value() }}</span>
      }
    </div>

    @if (supportingText(); as st) {
      <div class="mdy-supporting-text">
        <ng-container [ngTemplateOutlet]="st.template" />
      </div>
    }
    @if (!inlineErrors && touched() && hasErrors()) {
      <mdy-error-list [fieldId]="fieldId" [errors]="errors()" />
    }
  `,
})
export class MdySliderComponent extends MdyBaseControl<number> {
  readonly min       = input<number>(0);
  readonly max       = input<number>(100);
  readonly step      = input<number>(1);
  readonly showValue = input<boolean>(true);

  private readonly rangeInput = viewChild<ElementRef<HTMLInputElement>>('rangeInput');

  protected readonly fieldId = `mdy-control-slider-${MdyBaseControl.nextId()}`;

  constructor() {
    super();
    // Reactive fill: tracks value/min/max, so programmatic writes
    // (patchValue/reset) keep the visual bar in sync too (B21).
    effect(() => {
      const el = this.rangeInput()?.nativeElement;
      const value = this.value() ?? this.min();
      const min = this.min();
      const max = this.max();
      if (!el) return;
      const pct = max !== min ? ((value - min) / (max - min)) * 100 : 0;
      el.style.setProperty('--mdy-slider-fill-pct', `${pct}%`);
    });
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setValue(Number(input.value));
    this.markAsDirty();
  }

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setValue(Number(input.value));
    this.markAsDirty();
  }
}
